import type {
  AbilityEffect,
  AbilityState,
  ParseConfidence,
  ResourceType,
  ScalingStat,
  WrfAbility,
  WrfAbilityCost,
  WrfAbilitySlot,
} from '@wild-rift-forge/game-data';
import type { RawAbilityBlock } from './types';

const STATE_PREFIX =
  /^(first cast|second cast|third cast|recast|passive|active|empowered|transformed|charged|evolved)\b[:\s]*/i;

const RANK_RE = /(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?)){1,5}/g;
const SINGLE_NUM_RE = /\b(\d+(?:\.\d+)?)\b/;
const SCALE_RE =
  /\+(\d+(?:\.\d+)?)%\s*(bonus\s+)?(AD|AP|Health|HP|Armor|Magic Resist|MR|Mana)/gi;
const DAMAGE_TYPE_RE = /\b(physical|magic|true)\s+damage\b/i;
const HEAL_RE = /\bheals?\b/i;
const SHIELD_RE = /\bshield\b/i;
const MS_RE = /(\d+(?:\.\d+)?)%\s*movement speed/i;
const DURATION_RE = /for\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?){0,5})\s*seconds?/i;
const CC_RE =
  /\b(silences?|stuns?|roots?|charms?|fears?|taunts?|knocks? up|knocks? back)\b[^.]{0,48}?(\d+(?:\.\d+)?)\s*seconds?/i;

const SCALE_STAT: Record<string, ScalingStat> = {
  ad: 'total_ad',
  ap: 'ap',
  health: 'maximum_health',
  hp: 'maximum_health',
  armor: 'armor',
  'magic resist': 'magic_resistance',
  mr: 'magic_resistance',
  mana: 'mana',
};

function parseRankList(raw: string): Array<number | null> | null {
  const parts = raw.split(/\s*\/\s*/).map((part) => {
    const parsed = Number(part);
    return Number.isFinite(parsed) ? parsed : null;
  });
  return parts.length > 1 ? parts : null;
}

function firstRankOrNumber(text: string): Array<number | null> | number | undefined {
  RANK_RE.lastIndex = 0;
  const ranked = RANK_RE.exec(text);
  if (ranked?.[0]) {
    return parseRankList(ranked[0]) ?? undefined;
  }
  const single = text.match(SINGLE_NUM_RE);
  if (single?.[1]) {
    return Number(single[1]);
  }
  return undefined;
}

function parseScalings(text: string): AbilityEffect['scalings'] {
  const scalings: NonNullable<AbilityEffect['scalings']> = [];
  SCALE_RE.lastIndex = 0;
  let match = SCALE_RE.exec(text);
  while (match) {
    const ratio = Number(match[1]) / 100;
    const bonus = Boolean(match[2]);
    const key = (match[3] ?? '').toLowerCase();
    let stat = SCALE_STAT[key];
    if (stat === 'maximum_health' && bonus) {
      stat = 'bonus_health';
    }
    if (stat === 'total_ad' && bonus) {
      stat = 'bonus_ad';
    }
    if (stat && Number.isFinite(ratio)) {
      scalings.push({ stat, ratio });
    }
    match = SCALE_RE.exec(text);
  }
  return scalings.length > 0 ? scalings : undefined;
}

function parseDuration(text: string): AbilityEffect['duration'] {
  const ranked = text.match(/for\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?){1,5})\s*seconds?/i);
  if (ranked?.[1]) {
    return parseRankList(ranked[1]) ?? undefined;
  }
  const match = text.match(DURATION_RE);
  if (!match?.[1]) {
    return undefined;
  }
  return Number(match[1]);
}

function paragraphEffects(text: string): { effects: AbilityEffect[]; warning?: string } {
  const effects: AbilityEffect[] = [];
  const scalings = parseScalings(text);
  const duration = parseDuration(text);
  const missingHealth = /missing health/i.test(text);
  const maxHealth = /max(?:imum)? health/i.test(text);
  const complex = missingHealth || /x 0\.|champion level/i.test(text);

  if (DAMAGE_TYPE_RE.test(text) || /\bdeals?\b.*\bdamage\b/i.test(text)) {
    const damageTypeMatch = text.match(DAMAGE_TYPE_RE);
    const damageType = damageTypeMatch?.[1]?.toLowerCase() as
      | 'physical'
      | 'magic'
      | 'true'
      | undefined;
    const base = firstRankOrNumber(text);
    const type = missingHealth ? 'missing_health_damage' : maxHealth ? 'percent_health_damage' : 'damage';
    effects.push({
      type,
      damageType,
      base,
      scalings,
      duration,
      confidence: complex ? 'medium' : base != null ? 'high' : 'low',
      note: complex ? 'Formula kept in rawParsedText; structured fields are partial.' : undefined,
    });
  }

  if (HEAL_RE.test(text)) {
    effects.push({
      type: 'heal',
      base: firstRankOrNumber(text),
      scalings,
      confidence: complex ? 'medium' : 'high',
    });
  }

  if (SHIELD_RE.test(text)) {
    effects.push({
      type: 'shield',
      base: firstRankOrNumber(text),
      scalings,
      duration,
      confidence: 'high',
    });
  }

  const ms = text.match(MS_RE);
  if (ms?.[1]) {
    effects.push({
      type: 'movement_speed',
      percent: Number(ms[1]),
      duration,
      confidence: 'high',
    });
  }

  const cc = text.match(CC_RE);
  if (cc?.[1] && cc[2] && !/immune|breaks free|cleanses?/i.test(text)) {
    const kind = cc[1].toLowerCase().replace(/\s+/g, '');
    const mapped =
      kind.startsWith('knockup') || kind.startsWith('knocksup')
        ? 'knockup'
        : kind.startsWith('knockback') || kind.startsWith('knocksback')
          ? 'knockback'
          : kind.startsWith('silence')
            ? 'silence'
            : kind.startsWith('stun')
              ? 'stun'
              : kind.startsWith('root')
                ? 'root'
                : kind.startsWith('fear')
                  ? 'fear'
                  : kind.startsWith('charm')
                    ? 'charm'
                    : kind.startsWith('taunt')
                      ? 'taunt'
                      : 'other';
    effects.push({
      type: mapped,
      duration: Number(cc[2]),
      confidence: 'high',
    });
  }

  if (effects.length === 0 && /\d/.test(text)) {
    return {
      effects: [],
      warning: 'Numeric prose was not fully structured; rawParsedText kept.',
    };
  }

  return { effects };
}

function stateId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'initial';
}

function splitStates(paragraphs: string[]): AbilityState[] | undefined {
  const labeled = paragraphs
    .map((paragraph) => {
      const match = paragraph.match(STATE_PREFIX);
      if (!match) {
        return null;
      }
      return {
        id: stateId(match[1] ?? 'state'),
        label: (match[1] ?? 'state').replace(/^\w/, (ch) => ch.toUpperCase()),
        rawParsedText: paragraph.replace(STATE_PREFIX, '').trim() || paragraph,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  if (labeled.length < 2) {
    return undefined;
  }
  return labeled.map((row) => ({
    ...row,
    effects: paragraphEffects(row.rawParsedText).effects,
  }));
}

function worstConfidence(effects: AbilityEffect[], fallback: ParseConfidence): ParseConfidence {
  const rank: Record<ParseConfidence, number> = {
    high: 0,
    medium: 1,
    low: 2,
    manual_review: 3,
  };
  let worst: ParseConfidence = fallback;
  for (const effect of effects) {
    if (rank[effect.confidence] > rank[worst]) {
      worst = effect.confidence;
    }
  }
  return worst;
}

function normalizeProse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toCost(values: Array<number | null> | null, resource: ResourceType): WrfAbilityCost | null {
  if (!values?.length) {
    return null;
  }
  return { type: resource === 'none' ? 'other' : resource, values };
}

export function normalizeAbility(
  raw: RawAbilityBlock,
  slot: WrfAbilitySlot,
  resource: ResourceType,
): { ability: WrfAbility; warnings: string[] } {
  const warnings: string[] = [];
  const effects: AbilityEffect[] = [];
  for (const paragraph of raw.paragraphs) {
    const parsed = paragraphEffects(paragraph);
    effects.push(...parsed.effects);
    if (parsed.warning) {
      warnings.push(`${raw.name}: ${parsed.warning}`);
    }
  }
  const states = splitStates(raw.paragraphs);
  const confidence =
    effects.length > 0
      ? worstConfidence(effects, 'high')
      : raw.sourceText
        ? 'medium'
        : 'manual_review';

  return {
    ability: {
      slot,
      name: raw.name,
      form: raw.form,
      description: {
        normalized: normalizeProse(raw.sourceText),
        source: 'wildriftfire',
      },
      cooldown: raw.cooldown,
      cost: toCost(raw.costValues, resource),
      effects,
      states,
      rawParsedText: raw.sourceText,
      confidence,
    },
    warnings,
  };
}
