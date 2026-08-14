export type AbilityMarkupKind =
  | 'text'
  | 'physical'
  | 'magic'
  | 'true'
  | 'heal'
  | 'shield'
  | 'cc'
  | 'ad'
  | 'ap'
  | 'health'
  | 'armor'
  | 'mr'
  | 'note';

export type AbilityMarkupIcon = 'ad' | 'ap' | 'health' | 'armor' | 'mr';

export type AbilityMarkupSeg = {
  kind: AbilityMarkupKind;
  t: string;
  icon?: AbilityMarkupIcon;
};

export type AbilityTagTone =
  | 'passive'
  | 'physical'
  | 'magic'
  | 'true'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'control';

export type AbilityTag = {
  label: string;
  tone: AbilityTagTone;
};

type RawMatch = {
  start: number;
  end: number;
  kind: AbilityMarkupKind;
  t?: string;
  icon?: AbilityMarkupIcon;
  priority: number;
};

const STAT_ICON: Record<string, AbilityMarkupIcon> = {
  ad: 'ad',
  ap: 'ap',
  health: 'health',
  hp: 'health',
  armor: 'armor',
  mr: 'mr',
  'magic resist': 'mr',
};

const STAT_KIND: Record<AbilityMarkupIcon, AbilityMarkupKind> = {
  ad: 'ad',
  ap: 'ap',
  health: 'health',
  armor: 'armor',
  mr: 'mr',
};

const DAMAGE_KIND: Record<string, AbilityMarkupKind> = {
  physical: 'physical',
  magic: 'magic',
  true: 'true',
};

const RANK = String.raw`\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*`;
const SCALE_RE = new RegExp(
  String.raw`(\+)?((?:\d+(?:\.\d+)?%\s*\/\s*)*${RANK})(%?)\s*(bonus\s+)?(AD|AP|Health|HP|Armor|MR|Magic Resist)\b`,
  'gi',
);
const DAMAGE_RE = /\b(physical|magic|true)\s+damage\b/gi;
const HEAL_VERB_RE = /\b(heals?|healing|restores?|restoring)\b/gi;
const HEAL_FOR_RE = new RegExp(String.raw`\bfor\s+(${RANK})`, 'gi');
const HEAL_DIRECT_RE = new RegExp(String.raw`^(?:heals?|healing|restores?|restoring)\s+(${RANK})`, 'i');
const HEALTH_RE = /\b((?:max(?:imum)?|missing|bonus)\s+)?health\b/gi;
const SHIELD_RE = /\bshields?\b/gi;
const CC_RE =
  /\b(knocked up|knocks? (?:them |enemies |the target |targets )?up|knock up|airborne|stunned?|stunning|roots?|rooted|charms?|charmed|silences?|silenced|fears?|feared|taunts?|taunted|slows?|slowed|crowd control(?: effects)?)\b/gi;
const NOTE_RE = /\bdeals?\s+\d+(?:\.\d+)?%?\s+damage to (?:minions|monsters|non-champions)[^.]*\.?/gi;

function overlaps(a: RawMatch, b: RawMatch): boolean {
  return a.start < b.end && b.start < a.end;
}

function pushMatch(
  matches: RawMatch[],
  start: number,
  end: number,
  kind: AbilityMarkupKind,
  priority: number,
  icon?: AbilityMarkupIcon,
  t?: string,
): void {
  if (start < 0 || end <= start) return;
  matches.push({ start, end, kind, priority, icon, t });
}

function collectScalings(text: string, matches: RawMatch[]): void {
  SCALE_RE.lastIndex = 0;
  let match = SCALE_RE.exec(text);
  while (match) {
    const plus = match[1] ?? '';
    const nums = match[2] ?? '';
    const pct = match[3] ?? '';
    const stat = (match[5] ?? '').toLowerCase();
    const icon = STAT_ICON[stat];
    if (icon) {
      const labeled = `${plus}${nums}${pct}`;
      pushMatch(matches, match.index, match.index + match[0].length, STAT_KIND[icon], 10, icon, labeled);
    }
    match = SCALE_RE.exec(text);
  }
}

function leadingValueRange(text: string, phraseStart: number): { start: number; end: number } | null {
  let i = phraseStart;
  while (i > 0 && /\s/.test(text[i - 1] ?? '')) i -= 1;
  if (text[i - 1] === ')') {
    let depth = 1;
    let j = i - 2;
    while (j >= 0 && depth > 0) {
      if (text[j] === ')') depth += 1;
      if (text[j] === '(') depth -= 1;
      j -= 1;
    }
    i = j + 1;
    while (i > 0 && /\s/.test(text[i - 1] ?? '')) i -= 1;
  }
  const before = text.slice(0, i);
  const ranked = before.match(new RegExp(`(${RANK})\\s*$`));
  if (!ranked?.[1]) return null;
  return { start: i - ranked[1].length, end: i };
}

function collectDamage(text: string, matches: RawMatch[]): void {
  DAMAGE_RE.lastIndex = 0;
  let match = DAMAGE_RE.exec(text);
  while (match) {
    const kind = DAMAGE_KIND[(match[1] ?? '').toLowerCase()];
    if (kind) {
      pushMatch(matches, match.index, match.index + match[0].length, kind, 8);
      const value = leadingValueRange(text, match.index);
      if (value) {
        pushMatch(matches, value.start, value.end, kind, 8);
      }
    }
    match = DAMAGE_RE.exec(text);
  }
}

function collectHealValues(text: string, matches: RawMatch[]): void {
  HEAL_VERB_RE.lastIndex = 0;
  let match = HEAL_VERB_RE.exec(text);
  while (match) {
    pushMatch(matches, match.index, match.index + match[0].length, 'heal', 6);
    const stop = text.indexOf('.', match.index);
    const clause = text.slice(match.index, stop === -1 ? text.length : stop);
    const direct = clause.match(HEAL_DIRECT_RE);
    if (direct?.[1]) {
      const start = match.index + direct[0].length - direct[1].length;
      pushMatch(matches, start, start + direct[1].length, 'heal', 8);
    }
    HEAL_FOR_RE.lastIndex = 0;
    let found = HEAL_FOR_RE.exec(clause);
    while (found?.[1]) {
      const start = match.index + found.index + found[0].length - found[1].length;
      pushMatch(matches, start, start + found[1].length, 'heal', 8);
      found = HEAL_FOR_RE.exec(clause);
    }
    match = HEAL_VERB_RE.exec(text);
  }
}

function collectKeywords(text: string, matches: RawMatch[]): void {
  for (const [re, kind, priority] of [
    [HEALTH_RE, 'health', 6],
    [SHIELD_RE, 'shield', 6],
    [CC_RE, 'cc', 6],
    [NOTE_RE, 'note', 4],
  ] as const) {
    re.lastIndex = 0;
    let match = re.exec(text);
    while (match) {
      pushMatch(matches, match.index, match.index + match[0].length, kind, priority);
      match = re.exec(text);
    }
  }
}

function resolveMatches(matches: RawMatch[]): RawMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.end - b.start - (a.end - a.start);
  });
  const kept: RawMatch[] = [];
  for (const match of sorted) {
    if (kept.some((row) => overlaps(row, match))) continue;
    kept.push(match);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Color kit prose the way Wild Rift highlights damage, heals, CC, and scalings. */
export function parseAbilityMarkup(text: string): AbilityMarkupSeg[] {
  const src = text ?? '';
  if (!src) return [];
  const raw: RawMatch[] = [];
  collectScalings(src, raw);
  collectDamage(src, raw);
  collectHealValues(src, raw);
  collectKeywords(src, raw);
  const matches = resolveMatches(raw);
  if (matches.length === 0) return [{ kind: 'text', t: src }];

  const segs: AbilityMarkupSeg[] = [];
  let last = 0;
  for (const match of matches) {
    if (match.start > last) {
      segs.push({ kind: 'text', t: src.slice(last, match.start) });
    }
    segs.push({
      kind: match.kind,
      t: match.t ?? src.slice(match.start, match.end),
      icon: match.icon,
    });
    last = match.end;
  }
  if (last < src.length) {
    segs.push({ kind: 'text', t: src.slice(last) });
  }
  return segs;
}

const CC_TAG_RE =
  /\b(knock(?:ed|s)?(?:\s+\w+)?\s+up|airborne|stun|root|charm|silence|fear|taunt|slow|crowd control)\b/i;

/** Two tags max, matching the in-game name line: type plus heal/control/buff. */
export function inferAbilityTags(key: string, description: string): AbilityTag[] {
  const text = description ?? '';
  const tags: AbilityTag[] = [];
  if (key === 'P') {
    tags.push({ label: 'Passive', tone: 'passive' });
  } else if (/\bphysical damage\b/i.test(text)) {
    tags.push({ label: 'Physical', tone: 'physical' });
  } else if (/\bmagic damage\b/i.test(text)) {
    tags.push({ label: 'Magic', tone: 'magic' });
  } else if (/\btrue damage\b/i.test(text)) {
    tags.push({ label: 'True', tone: 'true' });
  }

  const cleanses = /\b(?:removes?|cleanses?|immune to)\b[\s\S]{0,40}\bcrowd control\b/i.test(text);
  if (/\bheals?\b|\bhealing\b|\brestor(?:es?|ing)\b/i.test(text)) {
    tags.push({ label: 'Heal', tone: 'heal' });
  } else if (CC_TAG_RE.test(text) && !cleanses) {
    tags.push({ label: 'Control', tone: 'control' });
  } else if (/\bshields?\b/i.test(text)) {
    tags.push({ label: 'Shield', tone: 'shield' });
  } else if (cleanses || /\b(?:buff|damage reduction|movement speed|attack speed)\b/i.test(text)) {
    tags.push({ label: 'Buff', tone: 'buff' });
  }

  return tags.slice(0, 2);
}
