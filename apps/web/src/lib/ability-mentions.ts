import type { AbilityInfo } from './abilities';

export const ABILITY_SLOTS: Record<string, string> = {
  P: 'PASSIVE',
  Q: 'ABILITY 1',
  W: 'ABILITY 2',
  E: 'ABILITY 3',
  R: 'ULTIMATE',
};

export type AbilityMentionKit = {
  name: string;
  abilities: AbilityInfo[];
};

export type AbilityTextSeg =
  | { kind: 'text'; t: string }
  | {
      kind: 'abil';
      id: string;
      key: string;
      champ: string;
      slot: string;
      name: string;
      text: string;
      imageUrl?: string;
      label?: string;
    };

const KEY_RE = /\b([QWERP])\b/g;
const OWN = new Set(['your', 'you', 'my']);
const THEIR = new Set(['his', 'her', 'their', 'its']);
const YOUR_ACTION = new Set(['use', 'cast', 'hold', 'save', 'spend', 'land', 'start', 'pop', 'fire']);
const FILLER = new Set(['a', 'an', 'the', 'brief', 'short', 'long', 'full', 'next', 'first']);

type MentionHit = {
  start: number;
  end: number;
  champ: string;
  ability: AbilityInfo | undefined;
  key: string;
  label?: string;
};

export function abilitySlotLabel(key: string): string {
  return ABILITY_SLOTS[key] ?? '';
}

export function findAbility(abilities: AbilityInfo[], key: string): AbilityInfo | undefined {
  return abilities.find((ability) => ability.key === key);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namedAbilities(kits: Record<string, AbilityInfo[]>): Array<{
  champ: string;
  ability: AbilityInfo;
}> {
  const rows: Array<{ champ: string; ability: AbilityInfo }> = [];
  for (const [champ, abilities] of Object.entries(kits)) {
    for (const ability of abilities) {
      if (ability.name.trim().length >= 3) {
        rows.push({ champ, ability });
      }
    }
  }
  return rows.sort((a, b) => b.ability.name.length - a.ability.name.length);
}

function champFromPrefix(
  prefix: string,
  ctx: { you: string; them: string; def: string; kits: Record<string, AbilityInfo[]> },
): string {
  const words = prefix.split(/[^A-Za-z]+/).filter(Boolean);
  const names = Object.keys(ctx.kits);
  for (let w = words.length - 1; w >= 0; w--) {
    const raw = words[w] ?? '';
    const lw = raw.toLowerCase();
    if (names.includes(raw)) {
      return raw;
    }
    if (THEIR.has(lw)) {
      return ctx.them;
    }
    if (OWN.has(lw)) {
      return ctx.you;
    }
    if (FILLER.has(lw)) {
      continue;
    }
    if (YOUR_ACTION.has(lw)) {
      return ctx.you;
    }
  }
  return ctx.def;
}

function collectHits(
  src: string,
  ctx: { you: string; them: string; def: string; kits: Record<string, AbilityInfo[]> },
): MentionHit[] {
  const hits: MentionHit[] = [];
  const named = namedAbilities(ctx.kits);
  if (named.length > 0) {
    const pattern = new RegExp(`\\b(?:${named.map((row) => escapeRe(row.ability.name)).join('|')})\\b`, 'gi');
    let match = pattern.exec(src);
    while (match) {
      const matched = match[0] ?? '';
      const lower = matched.toLowerCase();
      const candidates = named.filter((row) => row.ability.name.toLowerCase() === lower);
      const champ =
        candidates.length === 1
          ? candidates[0]!.champ
          : champFromPrefix(src.slice(0, match.index), ctx);
      const row =
        candidates.find((item) => item.champ === champ) ?? candidates[0] ?? named.find((item) => item.ability.name.toLowerCase() === lower);
      if (row) {
        hits.push({
          start: match.index,
          end: match.index + matched.length,
          champ: row.champ,
          ability: row.ability,
          key: row.ability.key,
          label: matched,
        });
      }
      match = pattern.exec(src);
    }
  }

  KEY_RE.lastIndex = 0;
  let keyMatch = KEY_RE.exec(src);
  while (keyMatch) {
    const start = keyMatch.index;
    const end = start + keyMatch[0].length;
    const overlaps = hits.some((hit) => start < hit.end && end > hit.start);
    if (!overlaps) {
      const champ = champFromPrefix(src.slice(0, start), ctx);
      const key = keyMatch[1] ?? '';
      hits.push({
        start,
        end,
        champ,
        ability: findAbility(ctx.kits[champ] ?? [], key),
        key,
      });
    }
    keyMatch = KEY_RE.exec(src);
  }

  return hits.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function parseAbilityMentions(
  text: string,
  id: string,
  ctx: { you: string; them: string; def: string; kits: Record<string, AbilityInfo[]> },
): AbilityTextSeg[] {
  const src = text ?? '';
  const hits = collectHits(src, ctx);
  if (hits.length === 0) {
    return [{ kind: 'text', t: src }];
  }
  const out: AbilityTextSeg[] = [];
  let last = 0;
  let i = 0;
  for (const hit of hits) {
    if (hit.start < last) {
      continue;
    }
    if (hit.start > last) {
      out.push({ kind: 'text', t: src.slice(last, hit.start) });
    }
    const ability = hit.ability;
    out.push({
      kind: 'abil',
      id: `${id}-${i}`,
      key: hit.key,
      champ: hit.champ,
      slot: `${hit.champ.toUpperCase()} · ${abilitySlotLabel(hit.key)}`.replace(/ · $/, ''),
      name: ability?.name ?? (hit.key === 'P' ? 'Passive' : hit.key === 'R' ? 'Ultimate' : 'Ability'),
      text: ability?.description || `${hit.champ}'s ${hit.key} has not been written up yet.`,
      imageUrl: ability?.imageUrl,
      label: hit.label,
    });
    i += 1;
    last = hit.end;
  }
  if (last < src.length) {
    out.push({ kind: 'text', t: src.slice(last) });
  }
  return out;
}
