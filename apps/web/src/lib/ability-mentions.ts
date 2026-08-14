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
    };

const KEY_RE = /\b([QWERP])\b/g;
const OWN = new Set(['your', 'you', 'my']);
const THEIR = new Set(['his', 'her', 'their', 'its']);

export function abilitySlotLabel(key: string): string {
  return ABILITY_SLOTS[key] ?? '';
}

export function findAbility(abilities: AbilityInfo[], key: string): AbilityInfo | undefined {
  return abilities.find((ability) => ability.key === key);
}

export function parseAbilityMentions(
  text: string,
  id: string,
  ctx: { you: string; them: string; def: string; kits: Record<string, AbilityInfo[]> },
): AbilityTextSeg[] {
  const src = text ?? '';
  const names = Object.keys(ctx.kits);
  const out: AbilityTextSeg[] = [];
  let last = 0;
  let i = 0;
  KEY_RE.lastIndex = 0;
  let match = KEY_RE.exec(src);
  while (match) {
    const words = src.slice(0, match.index).split(/[^A-Za-z]+/).filter(Boolean);
    let champ: string | null = null;
    for (let w = words.length - 1; w >= 0; w--) {
      const raw = words[w] ?? '';
      const lw = raw.toLowerCase();
      if (names.includes(raw)) {
        champ = raw;
        break;
      }
      if (THEIR.has(lw)) {
        champ = ctx.them;
        break;
      }
      if (OWN.has(lw)) {
        champ = ctx.you;
        break;
      }
    }
    champ = champ ?? ctx.def;
    const key = match[1] ?? '';
    const ability = findAbility(ctx.kits[champ] ?? [], key);
    if (match.index > last) {
      out.push({ kind: 'text', t: src.slice(last, match.index) });
    }
    out.push({
      kind: 'abil',
      id: `${id}-${i}`,
      key,
      champ,
      slot: `${champ.toUpperCase()} · ${abilitySlotLabel(key)}`.replace(/ · $/, ''),
      name: ability?.name ?? (key === 'P' ? 'Passive' : key === 'R' ? 'Ultimate' : 'Ability'),
      text: ability?.description || `${champ}'s ${key} has not been written up yet.`,
      imageUrl: ability?.imageUrl,
    });
    i += 1;
    last = match.index + match[0].length;
    match = KEY_RE.exec(src);
  }
  if (i === 0) return [{ kind: 'text', t: src }];
  if (last < src.length) out.push({ kind: 'text', t: src.slice(last) });
  return out;
}
