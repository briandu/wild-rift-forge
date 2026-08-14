import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type {
  ParseGap,
  ResourceType,
  WrfAbility,
  WrfAbilitySlot,
  WrfChampion,
  WrfChampionStats,
} from '@wild-rift-forge/game-data';
import { WRF_ABILITY_SLOTS } from '@wild-rift-forge/game-data';
import { normalizeAbility } from './normalize-ability';
import { parseAbilityBlocks } from './parse-abilities';
import { parseStatRows, resourceHintFromStats } from './parse-stats';
import type { RawAbilityBlock, RawChampionPage, RawStatRow } from './types';

const BASE_URL = 'https://www.wildriftfire.com';

const STAT_ALIASES: Record<string, keyof Pick<
  WrfChampionStats,
  | 'health'
  | 'healthRegen5'
  | 'attackDamage'
  | 'attackSpeed'
  | 'attackRange'
  | 'armor'
  | 'magicResistance'
  | 'movementSpeed'
>> = {
  health: 'health',
  'health reg. (5s)': 'healthRegen5',
  'health regen. (5s)': 'healthRegen5',
  'attack dmg.': 'attackDamage',
  'attack damage': 'attackDamage',
  'attack spd.': 'attackSpeed',
  'attack speed': 'attackSpeed',
  'attack range': 'attackRange',
  armor: 'armor',
  'magic res.': 'magicResistance',
  'magic resist.': 'magicResistance',
  'magic resistance': 'magicResistance',
  'move speed': 'movementSpeed',
  'movement speed': 'movementSpeed',
};

const PER_LEVEL: Record<string, keyof WrfChampionStats> = {
  health: 'healthPerLevel',
  healthRegen5: 'healthRegen5PerLevel',
  attackDamage: 'attackDamagePerLevel',
  attackSpeed: 'attackSpeedPerLevel',
  armor: 'armorPerLevel',
  magicResistance: 'magicResistancePerLevel',
};

function emptyStats(resource: ResourceType): WrfChampionStats {
  return {
    health: null,
    healthPerLevel: null,
    healthRegen5: null,
    healthRegen5PerLevel: null,
    resource: {
      type: resource,
      maximum: null,
      maximumPerLevel: null,
      regen5: null,
      regen5PerLevel: null,
    },
    attackDamage: null,
    attackDamagePerLevel: null,
    attackSpeed: null,
    attackSpeedPerLevel: null,
    attackRange: null,
    armor: null,
    armorPerLevel: null,
    magicResistance: null,
    magicResistancePerLevel: null,
    movementSpeed: null,
    additional: {},
  };
}

function applyStatRow(stats: WrfChampionStats, row: RawStatRow): void {
  const label = row.label.toLowerCase();
  if (label.includes('energy') && !label.includes('reg')) {
    stats.resource.type = 'energy';
    stats.resource.maximum = row.base;
    stats.resource.maximumPerLevel = row.perLevel;
    return;
  }
  if (label.includes('energy') && label.includes('reg')) {
    stats.resource.type = 'energy';
    stats.resource.regen5 = row.base;
    stats.resource.regen5PerLevel = row.perLevel;
    return;
  }
  if (/\bmana\b/.test(label) && !label.includes('reg')) {
    stats.resource.type = 'mana';
    stats.resource.maximum = row.base;
    stats.resource.maximumPerLevel = row.perLevel;
    return;
  }
  if (/\bmana\b/.test(label) && label.includes('reg')) {
    stats.resource.type = 'mana';
    stats.resource.regen5 = row.base;
    stats.resource.regen5PerLevel = row.perLevel;
    return;
  }
  const key = STAT_ALIASES[label];
  if (key) {
    stats[key] = row.base;
    const perLevelKey = PER_LEVEL[key];
    if (perLevelKey) {
      (stats[perLevelKey] as number | null) = row.perLevel;
    }
    return;
  }
  if (row.base != null) {
    stats.additional[row.label] = { base: row.base, perLevel: row.perLevel };
  }
}

function parsePositions($: CheerioAPI): string[] {
  const found = new Set<string>();
  $('.champion__desc .name img.lane, .additional-info img').each((_, element) => {
    const src = ($(element).attr('src') ?? '').toLowerCase();
    const match = src.match(/white-([a-z]+)\.png/);
    if (match?.[1] && match[1] !== 'lane') {
      found.add(match[1] === 'baron' ? 'solo' : match[1]);
    }
  });
  const roleText = $('.additional-info .data').eq(1).text().toLowerCase();
  if (roleText.includes('solo') || roleText.includes('baron')) found.add('solo');
  if (roleText.includes('mid')) found.add('mid');
  if (roleText.includes('jungle')) found.add('jungle');
  if (roleText.includes('dragon') || roleText.includes('duo')) found.add('dragon');
  if (roleText.includes('support')) found.add('support');
  return [...found];
}

function idFromUrl(url: string): string {
  const match = url.replace(/\/+$/, '').match(/\/guide\/([^/?#]+)$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

export function extractChampionPage(html: string, pageUrl: string): RawChampionPage {
  const $ = cheerio.load(html);
  const stats = parseStatRows($);
  const name =
    $('.champion__desc .name').first().clone().children().remove().end().text().replace(/\s+/g, ' ').trim() ||
    $('h1 span').first().text().trim();
  return {
    id: idFromUrl(pageUrl),
    name,
    title: $('.champion__desc .title').first().text().trim() || null,
    imageUrl: $('.champ-icon').first().attr('src')?.trim() ?? null,
    positions: parsePositions($),
    observedPatch: ($('#patch').attr('value') ?? $('.additional-info .data').first().text()).trim() || null,
    stats,
    abilities: parseAbilityBlocks($),
    resourceHint: resourceHintFromStats(stats),
  };
}

function placeholderAbility(slot: WrfAbilitySlot): WrfAbility {
  return {
    slot,
    name: slot,
    form: null,
    description: { normalized: '', source: 'wildriftfire' },
    cooldown: null,
    cost: null,
    effects: [],
    rawParsedText: '',
    confidence: 'manual_review',
  };
}

export function normalizeChampionPage(raw: RawChampionPage, scrapedAt: string, pageUrl: string): WrfChampion {
  const stats = emptyStats(raw.resourceHint);
  for (const row of raw.stats) {
    applyStatRow(stats, row);
  }

  const gaps: ParseGap[] = [];
  const parseWarnings: string[] = [];
  const bySlot = new Map<WrfAbilitySlot, WrfAbility>();
  const extraAbilities: WrfAbility[] = [];

  const used = new Set<RawAbilityBlock>();
  for (const slot of WRF_ABILITY_SLOTS) {
    const block = raw.abilities.find((ability) => ability.slot === slot && !used.has(ability));
    if (!block) {
      gaps.push({
        field: slot,
        kind: 'missing_from_source',
        detail: `No ${slot} ability block on the WildRiftFire page.`,
      });
      bySlot.set(slot, placeholderAbility(slot));
      continue;
    }
    used.add(block);
    const { ability, warnings } = normalizeAbility(block, slot, raw.resourceHint);
    parseWarnings.push(...warnings);
    bySlot.set(slot, ability);
    if (!ability.cooldown && slot !== 'passive') {
      gaps.push({
        field: `${slot}.cooldown`,
        kind: 'missing_from_source',
        detail: 'Cooldown spans were not present.',
      });
    }
    if (!ability.rawParsedText) {
      gaps.push({
        field: `${slot}.description`,
        kind: 'missing_from_source',
        detail: 'Ability body text was empty.',
      });
    }
    if (ability.confidence === 'manual_review') {
      gaps.push({
        field: `${slot}.effects`,
        kind: 'parser_failed',
        detail: `Ability normalize confidence is ${ability.confidence}.`,
      });
    }
  }

  for (const block of raw.abilities) {
    if (used.has(block)) {
      continue;
    }
    const slot = block.slot ?? 'q';
    const { ability, warnings } = normalizeAbility(block, slot, raw.resourceHint);
    parseWarnings.push(...warnings);
    extraAbilities.push(ability);
  }

  if (raw.stats.length === 0) {
    gaps.push({
      field: 'stats',
      kind: 'missing_from_source',
      detail: 'No champion stat rows were present.',
    });
  }

  return {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    roles: [],
    positions: raw.positions,
    imageUrl: raw.imageUrl,
    stats,
    abilities: {
      passive: bySlot.get('passive') ?? placeholderAbility('passive'),
      q: bySlot.get('q') ?? placeholderAbility('q'),
      w: bySlot.get('w') ?? placeholderAbility('w'),
      e: bySlot.get('e') ?? placeholderAbility('e'),
      r: bySlot.get('r') ?? placeholderAbility('r'),
    },
    extraAbilities,
    source: {
      provider: 'WildRiftFire',
      sourceType: 'champion_guide',
      url: pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}/guide/${raw.id}`,
      observedPatch: raw.observedPatch,
      scrapedAt,
    },
    gaps,
    parseWarnings,
  };
}
