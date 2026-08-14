import { createHash } from 'node:crypto';
import {
  getChampionBySlug,
  getLatestPatch,
  getMatchupGuide,
  listChampionAbilities,
  listLatestLaneStats,
  listPatchChanges,
  listPendingMatchupRequests,
  markMatchupRequestGenerated,
  requestMatchupGuide,
  claimMatchupGuideRequest,
  countInFlightMatchupGenerations,
  releaseMatchupGuideClaim,
  tryReserveMatchupGenerationCall,
  upsertMatchupGuide,
  type MatchupGuideAbilityNote,
  type MatchupGuideContent,
  type MatchupGuideSpike,
  type StoredChampionAbility,
  type StoredMatchupGuide,
} from '@wild-rift-forge/database';
import {
  DEFAULT_RANK_BRACKET,
  TIER_LANES,
  abilityHotkey,
  matchupVerdict,
  type ChangeType,
  type TierLane,
} from '@wild-rift-forge/game-data';
const DEFAULT_MODEL = 'gpt-5.6-sol';

function compactChampionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchPatchChampion(entityName: string, slugs: string[]): string | null {
  const key = compactChampionKey(entityName);
  if (!key) {
    return null;
  }
  const exact = slugs.find((slug) => compactChampionKey(slug) === key);
  if (exact) {
    return exact;
  }
  const hits = slugs.filter((slug) => compactChampionKey(slug).startsWith(key) && key.length >= 4);
  return hits.length === 1 ? hits[0]! : null;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const MATCHUP_PROMPT_VERSION = 5;

/** Append a line here when editorial policy changes, then bump MATCHUP_PROMPT_VERSION. */
export const MATCHUP_GUIDE_RULES = [
  'Write for a typical ranked player, not a Challenger one-trick.',
  'Write only from the seat of the you champion. The player locked that champion. Do not write the reverse matchup.',
  '"You" and "your" mean the you champion. "They" / "his" / "their" mean the enemy. Good trades are how you win; mistakes are how you lose.',
  'The lane win-rate verdict is already computed — do not change it or invent a head-to-head sample.',
  'Use only the supplied kits, rates, and patch lines. Do not invent abilities, numbers, or patch changes.',
  'Kit-based punish windows must follow how the abilities actually work.',
  'Do not invent items, runes, or pairwise win rates.',
  'Keep each field short. No filler.',
  'ability_notes are what to do against a spell, not a kit dump. Cue (when), consequence (then), the play (win), and why (note). Most rows are their threats; include one of yours when holding it changes the lane.',
  'Name the spell or mark the seat: "your Q", "his E", or Decimate. A bare Q/W/E/R is ambiguous and chips the wrong kit.',
  'spikes are when you can fight: LVL 1, LVL 3, LVL 5, 1st ITEM, LVL 11. label is the play at that beat, not a verdict. who is who owns that window. Do not name items.',
] as const;

const LANE_STYLES = ['CAUTIOUS / SHORT TRADES', 'EVEN / PUNISH', 'PRESS / EXTEND'] as const;
const PHASE_KEYS = ['EARLY', 'MID', 'LATE'] as const;
const PHASE_TITLES: Record<(typeof PHASE_KEYS)[number], string> = {
  EARLY: 'Levels 1–4',
  MID: 'Levels 5–10',
  LATE: 'Levels 11+',
};
const KIT_BREAKING_CHANGES = new Set<ChangeType>(['rework', 'new']);

const TRADE_SIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['steps', 'out'],
  properties: {
    steps: { type: 'array', items: { type: 'string' } },
    out: { type: 'string' },
  },
} as const;

const MATCHUP_GUIDE_SCHEMA = {
  name: 'matchup_guide',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'you_slug',
      'one_thing',
      'style',
      'style_pos',
      'phases',
      'trades',
      'mistakes',
      'tags',
      'ability_notes',
      'spikes',
    ],
    properties: {
      you_slug: { type: 'string' },
      one_thing: { type: 'string' },
      style: { type: 'string', enum: [...LANE_STYLES] },
      style_pos: { type: 'integer' },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['n', 't', 'body'],
          properties: {
            n: { type: 'string', enum: [...PHASE_KEYS] },
            t: { type: 'string' },
            body: { type: 'string' },
          },
        },
      },
      trades: {
        type: 'object',
        additionalProperties: false,
        required: ['good', 'bad'],
        properties: {
          good: TRADE_SIDE_SCHEMA,
          bad: TRADE_SIDE_SCHEMA,
        },
      },
      mistakes: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
      ability_notes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['own', 'k', 'when', 'then', 'win', 'note'],
          properties: {
            own: { type: 'boolean' },
            k: { type: 'string', enum: ['P', 'Q', 'W', 'E', 'R'] },
            when: { type: 'string' },
            then: { type: 'string' },
            win: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
      spikes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['at', 'who', 'label'],
          properties: {
            at: { type: 'string', enum: ['LVL 1', 'LVL 3', 'LVL 5', '1st ITEM', 'LVL 11'] },
            who: { type: 'string', enum: ['you', 'them', 'even'] },
            label: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export function matchupModel(): string {
  return process.env.OPENAI_MATCHUP_MODEL?.trim() || DEFAULT_MODEL;
}

export function matchupReasoningEffort(): 'low' | 'medium' | 'high' {
  const raw = process.env.OPENAI_MATCHUP_REASONING?.trim();
  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return 'high';
}

export type CompactAbility = {
  key: string;
  name: string;
  cooldown: Array<number | null> | null;
  cost: { type: string; values: Array<number | null> } | null;
  summary: string;
};

export type MatchupKitFact = {
  slug: string;
  name: string;
  roles: string[];
  abilities: CompactAbility[];
};

export type MatchupContextFact = {
  lane: TierLane;
  youWinRate: number | null;
  themWinRate: number | null;
  verdict: string;
  patchVersion: string | null;
  patchLines: string[];
  kitBreaking: boolean;
};

export function compactAbility(ability: StoredChampionAbility): CompactAbility {
  const summary =
    ability.numericSummary?.trim() ||
    (ability.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return {
    key: abilityHotkey(ability.slot),
    name: ability.name,
    cooldown: ability.cooldown,
    cost: ability.cost,
    summary,
  };
}

export function fingerprintKit(you: MatchupKitFact, them: MatchupKitFact): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        promptVersion: MATCHUP_PROMPT_VERSION,
        you: { slug: you.slug, abilities: you.abilities },
        them: { slug: them.slug, abilities: them.abilities },
      }),
    )
    .digest('hex');
}

export function fingerprintContext(context: MatchupContextFact): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        lane: context.lane,
        youWinRate: context.youWinRate == null ? null : Number(context.youWinRate.toFixed(1)),
        themWinRate: context.themWinRate == null ? null : Number(context.themWinRate.toFixed(1)),
        verdict: context.verdict,
        patchVersion: context.patchVersion,
        patchLines: context.patchLines,
      }),
    )
    .digest('hex');
}

export function kitRequiresRefresh(
  stored: Pick<StoredMatchupGuide, 'kitHash' | 'promptVersion'> | null,
  kitHash: string,
  kitBreaking: boolean,
): boolean {
  if (!stored) {
    return true;
  }
  if (stored.promptVersion !== MATCHUP_PROMPT_VERSION) {
    return true;
  }
  if (stored.kitHash !== kitHash) {
    return true;
  }
  return kitBreaking;
}

function asStringArray(value: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length < min || items.length > max) {
    return null;
  }
  return items;
}

const ABILITY_KEYS = new Set(['P', 'Q', 'W', 'E', 'R']);

export function parseAbilityNotes(
  raw: unknown,
  kits?: { you: readonly string[]; them: readonly string[] },
): MatchupGuideAbilityNote[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const seen = new Set<string>();
  const notes: MatchupGuideAbilityNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.own !== 'boolean') {
      continue;
    }
    const k = typeof row.k === 'string' ? row.k.trim().toUpperCase() : '';
    if (!ABILITY_KEYS.has(k)) {
      continue;
    }
    if (kits && !(row.own ? kits.you : kits.them).includes(k)) {
      continue;
    }
    const id = `${row.own ? 'you' : 'them'}:${k}`;
    if (seen.has(id)) {
      continue;
    }
    const when = typeof row.when === 'string' ? row.when.trim() : '';
    const then = typeof row.then === 'string' ? row.then.trim() : '';
    const win = typeof row.win === 'string' ? row.win.trim() : '';
    const note = typeof row.note === 'string' ? row.note.trim() : '';
    if (when.length < 8 || when.length > 90) {
      continue;
    }
    if (then.length < 6 || then.length > 80) {
      continue;
    }
    if (win.length < 6 || win.length > 48) {
      continue;
    }
    if (note.length < 20 || note.length > 220) {
      continue;
    }
    seen.add(id);
    notes.push({ own: row.own, k, when, then, win, note });
  }
  if (notes.length < 3 || notes.length > 6 || notes.filter((row) => !row.own).length < 2) {
    return null;
  }
  return notes;
}

const SPIKE_ATS = ['LVL 1', 'LVL 3', 'LVL 5', '1st ITEM', 'LVL 11'] as const;
const SPIKE_WHOS = ['you', 'them', 'even'] as const;

export function parseSpikes(raw: unknown): MatchupGuideSpike[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const spikes = SPIKE_ATS.flatMap((at) => {
    const row = raw.find((item) => {
      return item && typeof item === 'object' && (item as { at?: unknown }).at === at;
    }) as { who?: unknown; label?: unknown } | undefined;
    const who = SPIKE_WHOS.find((value) => value === row?.who);
    const label = typeof row?.label === 'string' ? row.label.trim() : '';
    if (!who || label.length < 8 || label.length > 72) {
      return [];
    }
    return [{ at, who, label }];
  });
  return spikes.length === SPIKE_ATS.length ? spikes : null;
}

export function parseMatchupGuide(
  raw: unknown,
  youSlug?: string,
  kits?: { you: readonly string[]; them: readonly string[] },
): MatchupGuideContent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const body = raw as Record<string, unknown>;
  const reported = typeof body.you_slug === 'string' ? body.you_slug.trim().toLowerCase() : '';
  if (youSlug && reported !== youSlug) {
    return null;
  }
  const oneThing = typeof body.one_thing === 'string' ? body.one_thing.trim() : '';
  const style = LANE_STYLES.find((item) => item === body.style);
  const stylePos = typeof body.style_pos === 'number' ? Math.round(body.style_pos) : NaN;
  if (oneThing.length < 20 || oneThing.length > 240 || !style || stylePos < 0 || stylePos > 100) {
    return null;
  }
  const phasesRaw = Array.isArray(body.phases) ? body.phases : [];
  const phases = PHASE_KEYS.flatMap((key) => {
    const row = phasesRaw.find((item) => {
      return item && typeof item === 'object' && (item as { n?: unknown }).n === key;
    }) as { t?: unknown; body?: unknown } | undefined;
    const text = typeof row?.body === 'string' ? row.body.trim() : '';
    if (text.length < 40) {
      return [];
    }
    return [
      {
        n: key,
        t: typeof row?.t === 'string' && row.t.trim() ? row.t.trim() : PHASE_TITLES[key],
        body: text,
      },
    ];
  });
  if (phases.length !== 3) {
    return null;
  }
  const tradesRaw = body.trades && typeof body.trades === 'object' ? (body.trades as Record<string, unknown>) : null;
  const goodSteps = asStringArray((tradesRaw?.good as { steps?: unknown } | undefined)?.steps, 3, 5);
  const badSteps = asStringArray((tradesRaw?.bad as { steps?: unknown } | undefined)?.steps, 3, 5);
  const goodOut =
    typeof (tradesRaw?.good as { out?: unknown } | undefined)?.out === 'string'
      ? ((tradesRaw?.good as { out: string }).out.trim())
      : '';
  const badOut =
    typeof (tradesRaw?.bad as { out?: unknown } | undefined)?.out === 'string'
      ? ((tradesRaw?.bad as { out: string }).out.trim())
      : '';
  const mistakes = asStringArray(body.mistakes, 2, 5);
  const tags = asStringArray(body.tags, 0, 6);
  const abilityNotes = parseAbilityNotes(body.ability_notes, kits);
  const spikes = parseSpikes(body.spikes);
  if (
    !goodSteps ||
    !badSteps ||
    !mistakes ||
    !tags ||
    !abilityNotes ||
    !spikes ||
    goodOut.length < 8 ||
    badOut.length < 8
  ) {
    return null;
  }
  return {
    oneThing,
    style,
    stylePos,
    phases,
    trades: {
      good: { steps: goodSteps, out: goodOut },
      bad: { steps: badSteps, out: badOut },
    },
    mistakes,
    tags,
    abilityNotes,
    spikes,
  };
}

function patchLine(change: {
  changeType: string;
  ability: string | null;
  property: string | null;
  description: string | null;
}): string {
  return [change.changeType, change.ability, change.property, change.description]
    .filter(Boolean)
    .join(' · ');
}

async function completeMatchupGuide(prompt: string, apiKey: string, model: string): Promise<unknown> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning_effort: matchupReasoningEffort(),
      messages: [
        {
          role: 'system',
          content: [
            'You write a Wild Rift lane matchup guide.',
            ...MATCHUP_GUIDE_RULES.map((rule, index) => `${index + 1}. ${rule}`),
          ].join('\n'),
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: MATCHUP_GUIDE_SCHEMA,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && detail.includes('insufficient_quota')) {
      throw new Error(
        'OpenAI rejected the request: this API key has no remaining quota. Add billing at https://platform.openai.com/settings/organization/billing and re-run scrape:matchups-generate.',
      );
    }
    throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 400)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response was missing message content');
  }
  return JSON.parse(content) as unknown;
}

export interface GenerateMatchupResult {
  you: string;
  them: string;
  lane: TierLane;
  status: 'written' | 'skipped' | 'missing-key' | 'invalid' | 'budget';
  reason: string;
}

async function loadPairFacts(youSlug: string, themSlug: string, lane: TierLane) {
  const [youChamp, themChamp, patch] = await Promise.all([
    getChampionBySlug(youSlug),
    getChampionBySlug(themSlug),
    getLatestPatch(),
  ]);
  if (!youChamp || !themChamp) {
    return null;
  }
  const [youAbilities, themAbilities, latestStats, changes] = await Promise.all([
    listChampionAbilities(youChamp.id),
    listChampionAbilities(themChamp.id),
    listLatestLaneStats(DEFAULT_RANK_BRACKET).catch(() => ({ snapshotDate: '', rows: [] })),
    patch ? listPatchChanges(patch.id) : Promise.resolve([]),
  ]);
  const youKit: MatchupKitFact = {
    slug: youChamp.slug,
    name: youChamp.name,
    roles: youChamp.roles,
    abilities: youAbilities.map(compactAbility),
  };
  const themKit: MatchupKitFact = {
    slug: themChamp.slug,
    name: themChamp.name,
    roles: themChamp.roles,
    abilities: themAbilities.map(compactAbility),
  };
  const youRow = latestStats.rows.find((row) => row.slug === youSlug && row.lane === lane);
  const themRow = latestStats.rows.find((row) => row.slug === themSlug && row.lane === lane);
  const youWr = youRow?.winRate ?? null;
  const themWr = themRow?.winRate ?? null;
  const side = youWr != null && themWr != null ? matchupVerdict(youWr, themWr).side : 'even';
  const verdict =
    youWr == null || themWr == null
      ? 'No lane snapshot'
      : side === 'you'
        ? `${youChamp.name} favoured`
        : side === 'them'
          ? `${themChamp.name} favoured`
          : 'Even matchup';
  const slugs = [youChamp.slug, themChamp.slug];
  const patchLines: string[] = [];
  let kitBreaking = false;
  for (const change of changes) {
    if (change.entityType !== 'champion') {
      continue;
    }
    const slug = matchPatchChampion(change.entityName, slugs);
    if (!slug) {
      continue;
    }
    const line = patchLine(change);
    if (line) {
      patchLines.push(`${slug}: ${line}`);
    }
    if (KIT_BREAKING_CHANGES.has(change.changeType)) {
      kitBreaking = true;
    }
  }
  const context: MatchupContextFact = {
    lane,
    youWinRate: youWr,
    themWinRate: themWr,
    verdict,
    patchVersion: patch?.version ?? null,
    patchLines: patchLines.slice(0, 8),
    kitBreaking,
  };
  return { youChamp, themChamp, youKit, themKit, context };
}

export async function generateMatchupGuide(options: {
  you: string;
  them: string;
  lane: TierLane;
  force?: boolean;
}): Promise<GenerateMatchupResult> {
  const you = options.you.trim().toLowerCase();
  const them = options.them.trim().toLowerCase();
  const lane = options.lane;
  const model = matchupModel();
  if (!you || !them || you === them) {
    return { you, them, lane, status: 'invalid', reason: 'you and them must be different slugs' };
  }
  const facts = await loadPairFacts(you, them, lane);
  if (!facts) {
    return { you, them, lane, status: 'invalid', reason: 'Champion not in the roster' };
  }
  const kitHash = fingerprintKit(facts.youKit, facts.themKit);
  const contextHash = fingerprintContext(facts.context);
  const stored = await getMatchupGuide(facts.youChamp.id, facts.themChamp.id, lane);
  if (!options.force && !kitRequiresRefresh(stored, kitHash, facts.context.kitBreaking)) {
    await markMatchupRequestGenerated(facts.youChamp.id, facts.themChamp.id, lane);
    console.log(
      `Matchup ${facts.youChamp.name} vs ${facts.themChamp.name} ${lane} is current (kit unchanged). Skipping OpenAI.`,
    );
    return {
      you,
      them,
      lane,
      status: 'skipped',
      reason: 'kit unchanged — reused stored punish/trade copy',
    };
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    await requestMatchupGuide(facts.youChamp.id, facts.themChamp.id, lane);
    console.log('OPENAI_API_KEY is not set — queued the matchup instead of generating.');
    return { you, them, lane, status: 'missing-key', reason: 'OPENAI_API_KEY is not set' };
  }
  if (!matchupGenerationEnabled()) {
    console.warn('Matchup generation is disabled (OPENAI_MATCHUP_GENERATION). Skipping OpenAI.');
    return { you, them, lane, status: 'budget', reason: 'generation disabled' };
  }
  const reserved = await tryReserveMatchupGenerationCall({
    day: matchupDailyLimit(),
    hour: matchupHourlyLimit(),
  });
  if (!reserved.ok) {
    console.warn(
      `Matchup generation ${reserved.reason} budget reached — skipping OpenAI for ${facts.youChamp.name} vs ${facts.themChamp.name}.`,
    );
    return { you, them, lane, status: 'budget', reason: `budget:${reserved.reason}` };
  }
  const prompt = [
    `You are coaching someone who locked ${facts.youKit.name} into ${facts.themKit.name} in ${lane}.`,
    `you_slug must be "${you}". Every field is what they should do as ${facts.youKit.name}.`,
    `Do not write the ${facts.themKit.name} side of this lane. That is a different page.`,
    `${facts.youKit.name} (you) vs ${facts.themKit.name} (them).`,
    `Computed lane verdict: ${facts.context.verdict}. These are ${lane} win rates, not a pairwise sample.`,
    facts.context.youWinRate != null && facts.context.themWinRate != null
      ? `Lane rates: ${facts.youKit.name} ${facts.context.youWinRate.toFixed(1)}% · ${facts.themKit.name} ${facts.context.themWinRate.toFixed(1)}%.`
      : 'No ranked snapshot for this lane yet.',
    facts.context.patchVersion
      ? `Latest patch ${facts.context.patchVersion}.`
      : 'No stored patch notes.',
    facts.context.patchLines.length > 0
      ? `Patch lines for these two champions:\n${facts.context.patchLines.join('\n')}`
      : 'No patch lines for these two champions. Do not invent any.',
    'Write the plan, trades, mistakes, and ability_notes from how the kits actually work. Do not write items or runes.',
    'ability_notes: 4–6 rows. Prefer their key threats plus one of your holds. when is the cue, then is what that means, win is the play, note is why. Do not restate kit descriptions or numbers.',
    'spikes: one row each for LVL 1, LVL 3, LVL 5, 1st ITEM, LVL 11. label is what to do at that beat. Do not name items.',
    JSON.stringify(
      {
        you: facts.youKit,
        them: facts.themKit,
      },
      null,
      2,
    ),
  ].join('\n');
  const parsed = parseMatchupGuide(await completeMatchupGuide(prompt, apiKey, model), you, {
    you: facts.youKit.abilities.map((ability) => ability.key),
    them: facts.themKit.abilities.map((ability) => ability.key),
  });
  if (!parsed) {
    throw new Error(`OpenAI returned an unusable guide for ${you} vs ${them} ${lane}`);
  }
  await upsertMatchupGuide({
    youChampionId: facts.youChamp.id,
    themChampionId: facts.themChamp.id,
    lane,
    patchVersion: facts.context.patchVersion,
    kitHash,
    contextHash,
    model,
    promptVersion: MATCHUP_PROMPT_VERSION,
    ...parsed,
  });
  await markMatchupRequestGenerated(facts.youChamp.id, facts.themChamp.id, lane);
  console.log(`Stored ${facts.youChamp.name} vs ${facts.themChamp.name} ${lane} (${model}).`);
  return { you, them, lane, status: 'written', reason: 'generated' };
}

export async function generateRequestedMatchups(limit = 10): Promise<GenerateMatchupResult[]> {
  const pending = await listPendingMatchupRequests(limit);
  if (pending.length === 0) {
    console.log('No queued matchup guides.');
    return [];
  }
  const results: GenerateMatchupResult[] = [];
  for (const row of pending) {
    results.push(
      await generateMatchupGuide({
        you: row.youSlug,
        them: row.themSlug,
        lane: row.lane,
      }),
    );
  }
  return results;
}

export function parseLaneFlag(value: string | undefined): TierLane {
  if (value && TIER_LANES.includes(value as TierLane)) {
    return value as TierLane;
  }
  return 'Top';
}

export function matchupConcurrencyLimit(): number {
  return parseMatchupLimit(process.env.OPENAI_MATCHUP_CONCURRENCY, 2, 8);
}

export function matchupDailyLimit(): number {
  return parseMatchupLimit(process.env.OPENAI_MATCHUP_DAILY_LIMIT, 40, 500);
}

export function matchupHourlyLimit(): number {
  return parseMatchupLimit(process.env.OPENAI_MATCHUP_HOURLY_LIMIT, 8, 80);
}

export function parseMatchupLimit(
  raw: string | undefined,
  fallback: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.min(Math.floor(n), max);
}

export function matchupGenerationEnabled(): boolean {
  const raw = process.env.OPENAI_MATCHUP_GENERATION?.trim().toLowerCase();
  if (!raw) {
    return true;
  }
  return raw !== 'off' && raw !== '0' && raw !== 'false' && raw !== 'disabled';
}

export function hasMatchupGenerationSlot(inFlight: number, limit = matchupConcurrencyLimit()): boolean {
  return inFlight < limit;
}

/**
 * If this pairing has no guide, claim it and generate. Safe to call on every
 * page load: a stored guide, an in-flight claim, or a full concurrency slot
 * all return without spending tokens.
 */
export async function ensureMatchupGuide(options: {
  you: string;
  them: string;
  lane: TierLane;
}): Promise<GenerateMatchupResult | null> {
  const you = options.you.trim().toLowerCase();
  const them = options.them.trim().toLowerCase();
  const lane = options.lane;
  if (!you || !them || you === them) {
    return null;
  }
  const [youChamp, themChamp] = await Promise.all([
    getChampionBySlug(you),
    getChampionBySlug(them),
  ]);
  if (!youChamp || !themChamp) {
    return null;
  }
  const existing = await getMatchupGuide(youChamp.id, themChamp.id, lane);
  if (existing) {
    return { you, them, lane, status: 'skipped', reason: 'already stored' };
  }
  await requestMatchupGuide(youChamp.id, themChamp.id, lane);
  if (!matchupGenerationEnabled()) {
    return { you, them, lane, status: 'budget', reason: 'generation disabled' };
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { you, them, lane, status: 'missing-key', reason: 'OPENAI_API_KEY is not set' };
  }
  const inFlight = await countInFlightMatchupGenerations();
  if (!hasMatchupGenerationSlot(inFlight)) {
    return { you, them, lane, status: 'skipped', reason: 'generation cap' };
  }
  const claimed = await claimMatchupGuideRequest(youChamp.id, themChamp.id, lane);
  if (!claimed) {
    return { you, them, lane, status: 'skipped', reason: 'already in flight' };
  }
  try {
    const result = await generateMatchupGuide({ you, them, lane });
    if (result.status === 'missing-key' || result.status === 'invalid' || result.status === 'budget') {
      await releaseMatchupGuideClaim(youChamp.id, themChamp.id, lane);
    }
    return result;
  } catch (error) {
    await releaseMatchupGuideClaim(youChamp.id, themChamp.id, lane);
    throw error;
  }
}
