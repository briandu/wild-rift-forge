import { createHash } from 'node:crypto';
import {
  getLatestPatch,
  getLatestSnapshotDate,
  listLatestTierPlacements,
  listPatchChanges,
  listTierAdjustments,
  listTierExplanations,
  upsertTierExplanations,
  type StoredTierPlacement,
  type TierExplanationInput,
} from '@wild-rift-forge/database';
import {
  DEFAULT_RANK_BRACKET,
  DEFAULT_TIER_RULESET,
  type RankBracket,
  type TierLane,
  type TierLetter,
  type TierRuleset,
} from '@wild-rift-forge/game-data';
import { matchHeroToRoster } from '../sources/tencent/hero-map';

const DEFAULT_MODEL = 'gpt-5.6-sol';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const BATCH_SIZE = 20;

export function explainModel(): string {
  return process.env.OPENAI_TIER_EXPLAIN_MODEL?.trim() || DEFAULT_MODEL;
}

const EXPLAIN_SCHEMA = {
  name: 'tier_explanations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['explanations'],
    properties: {
      explanations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'lane', 'why'],
          properties: {
            slug: { type: 'string' },
            lane: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export type ExplanationFact = {
  slug: string;
  name: string;
  lane: TierLane;
  letter: TierLetter;
  rankInLane: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  adjustedWinRate: number | null;
  skillSpread: number | null;
  confidence: number | null;
  score: number;
  previousLetter: TierLetter | null;
  patchLines: string[];
  signals: string[];
};

export function signalNotes(row: {
  winRate: number;
  pickRate: number;
  banRate: number;
  adjustedWinRate: number | null;
  skillSpread: number | null;
  confidence: number | null;
  letter: TierLetter;
  previousLetter: TierLetter | null;
}): string[] {
  const notes: string[] = [];
  if (row.confidence != null && row.confidence < 0.45) {
    notes.push(
      `Low sample: ${row.pickRate.toFixed(1)}% pick rate, so the win rate is pulled toward the lane average.`,
    );
  } else if (row.confidence != null && row.confidence >= 0.75) {
    notes.push(`Trusted sample: ${row.pickRate.toFixed(1)}% pick rate.`);
  }
  if (row.adjustedWinRate != null && Math.abs(row.adjustedWinRate - row.winRate) >= 1) {
    notes.push(
      `Raw win rate ${row.winRate.toFixed(1)}% shrinks to ${row.adjustedWinRate.toFixed(1)}% after sample-size adjustment.`,
    );
  }
  if (row.skillSpread != null && row.skillSpread <= -1) {
    notes.push(
      `Stronger in average games than Challenger (spread ${row.skillSpread.toFixed(1)}), so this list does not discount it.`,
    );
  } else if (row.skillSpread != null && row.skillSpread >= 1.5) {
    notes.push(
      `Much stronger in Challenger than average (spread +${row.skillSpread.toFixed(1)}); discounted for a typical ladder player.`,
    );
  }
  if (row.banRate >= 12) {
    notes.push(`Ban rate ${row.banRate.toFixed(1)}% is a small contested-power signal.`);
  }
  return notes;
}

export function fingerprintExplanation(fact: ExplanationFact, model = DEFAULT_MODEL): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        model,
        slug: fact.slug,
        lane: fact.lane,
        letter: fact.letter,
        rankInLane: fact.rankInLane,
        winRate: Number(fact.winRate.toFixed(1)),
        pickRate: Number(fact.pickRate.toFixed(1)),
        banRate: Number(fact.banRate.toFixed(1)),
        adjustedWinRate: fact.adjustedWinRate == null ? null : Number(fact.adjustedWinRate.toFixed(1)),
        skillSpread: fact.skillSpread == null ? null : Number(fact.skillSpread.toFixed(1)),
        confidence: fact.confidence == null ? null : Number(fact.confidence.toFixed(2)),
        previousLetter: fact.previousLetter,
        patchLines: fact.patchLines,
        signals: fact.signals,
        promptVersion: 2,
      }),
    )
    .digest('hex');
}

export function whyIsUsable(why: string): boolean {
  const lower = why.toLowerCase();
  const mentionsMove = /prior snapshot|moved from s\+|moved from [sabc]/.test(lower);
  const mentionsStat = /win rate|pick|ban|sample|spread|challenger|adjust/.test(lower);
  return why.length >= 40 && (!mentionsMove || mentionsStat);
}

export function parseExplanations(
  raw: unknown,
  allowed: ReadonlySet<string>,
): Array<{ slug: string; lane: TierLane; why: string }> {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const body = raw as { explanations?: unknown };
  const rows = Array.isArray(body.explanations) ? body.explanations : [];
  return rows.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as { slug?: unknown; lane?: unknown; why?: unknown };
    const slug = typeof row.slug === 'string' ? row.slug : '';
    const lane = typeof row.lane === 'string' ? row.lane : '';
    const why = typeof row.why === 'string' ? row.why.trim() : '';
    const key = `${slug}:${lane}`;
    if (!allowed.has(key) || !whyIsUsable(why)) {
      return [];
    }
    return [{ slug, lane: lane as TierLane, why }];
  });
}

function factFromPlacement(
  row: StoredTierPlacement,
  patchLines: string[],
): ExplanationFact {
  const base = {
    winRate: row.winRate,
    pickRate: row.pickRate,
    banRate: row.banRate,
    adjustedWinRate: row.adjustedWinRate ?? null,
    skillSpread: row.skillSpread ?? null,
    confidence: row.confidence ?? null,
    letter: row.letter,
    previousLetter: row.previousLetter ?? null,
  };
  return {
    slug: row.slug,
    name: row.name,
    lane: row.lane,
    letter: row.letter,
    rankInLane: row.rankInLane,
    ...base,
    score: row.score,
    patchLines,
    signals: signalNotes(base),
  };
}

async function completeExplanations(prompt: string, apiKey: string, model: string): Promise<unknown> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            'You explain Wild Rift Forge tier placements for players. Use only the facts. Do not invent rates or change the letter. The why must cite current performance: adjusted win rate, pick-rate sample, skill spread, bans, or a patch change. Never say a champion is in a tier because they moved from another letter. A snapshot move is not a reason.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: EXPLAIN_SCHEMA,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && detail.includes('insufficient_quota')) {
      throw new Error(
        'OpenAI rejected the request: this API key has no remaining quota. Add billing at https://platform.openai.com/settings/organization/billing and re-run scrape:tiers-explain.',
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

export interface ExplainTiersResult {
  snapshotDate: string | null;
  status: 'written' | 'skipped' | 'missing-key';
  considered: number;
  written: number;
}

export async function explainTierPlacements(options?: {
  bracket?: RankBracket;
  ruleset?: TierRuleset;
}): Promise<ExplainTiersResult> {
  const bracket = options?.bracket ?? DEFAULT_RANK_BRACKET;
  const ruleset = options?.ruleset ?? DEFAULT_TIER_RULESET;
  const model = explainModel();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const snapshotDate = await getLatestSnapshotDate(bracket);
  if (!snapshotDate) {
    console.log('No ranked snapshot stored. Run scrape:stats first.');
    return { snapshotDate: null, status: 'skipped', considered: 0, written: 0 };
  }

  const [{ placements }, existing, patch] = await Promise.all([
    listLatestTierPlacements(bracket, undefined, ruleset),
    listTierExplanations(snapshotDate, bracket, ruleset),
    getLatestPatch(),
  ]);
  const cycleKey = patch?.version ?? snapshotDate;
  const solMoves = cycleKey ? await listTierAdjustments(cycleKey, ruleset) : [];
  const solByChampionLane = new Map(
    solMoves.map((row) => [`${row.championId}:${row.lane}`, row]),
  );
  const changes = patch ? await listPatchChanges(patch.id) : [];
  const slugs = [...new Set(placements.map((row) => row.slug))];
  const patchBySlug = new Map<string, string[]>();
  for (const change of changes) {
    if (change.entityType !== 'champion') {
      continue;
    }
    const slug = matchHeroToRoster(change.entityName, slugs);
    if (!slug) {
      continue;
    }
    const line = [change.changeType, change.ability, change.property, change.description]
      .filter(Boolean)
      .join(' · ');
    if (!line) {
      continue;
    }
    const current = patchBySlug.get(slug) ?? [];
    current.push(line);
    patchBySlug.set(slug, current);
  }

  const existingByKey = new Map(
    existing.map((row) => [`${row.championId}:${row.lane}`, row]),
  );
  const pending: Array<{ placement: StoredTierPlacement; fact: ExplanationFact; hash: string }> =
    [];
  for (const placement of placements) {
    const fact = factFromPlacement(placement, (patchBySlug.get(placement.slug) ?? []).slice(0, 4));
    const sol = solByChampionLane.get(`${placement.championId}:${placement.lane}`);
    if (sol) {
      fact.signals.push(
        `Sol review moved this from ${sol.letterBefore} to ${sol.letterAfter}: ${sol.reason}`,
      );
    }
    const hash = fingerprintExplanation(fact, model);
    const stored = existingByKey.get(`${placement.championId}:${placement.lane}`);
    if (stored?.promptHash === hash && stored.why) {
      continue;
    }
    pending.push({ placement, fact, hash });
  }

  if (pending.length === 0) {
    console.log(`Tier explanations for ${snapshotDate} ${bracket} are current. Skipping OpenAI.`);
    return { snapshotDate, status: 'skipped', considered: placements.length, written: 0 };
  }
  if (!apiKey) {
    console.log('OPENAI_API_KEY is not set — skipping tier explanations.');
    return { snapshotDate, status: 'missing-key', considered: pending.length, written: 0 };
  }

  const writtenRows: TierExplanationInput[] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const allowed = new Set(batch.map((row) => `${row.fact.slug}:${row.fact.lane}`));
    const prompt = [
      `Snapshot ${snapshotDate}, ${bracket}, ruleset ${ruleset}.`,
      'Write a one- or two-sentence why for each champion. Slug and lane must match the facts.',
      'Lead with the current numbers. Do not mention a prior snapshot or a letter change unless you also explain the stats.',
      JSON.stringify(
        batch.map((row) => ({
          slug: row.fact.slug,
          name: row.fact.name,
          lane: row.fact.lane,
          letter: row.fact.letter,
          rankInLane: row.fact.rankInLane,
          winRate: row.fact.winRate,
          pickRate: row.fact.pickRate,
          banRate: row.fact.banRate,
          adjustedWinRate: row.fact.adjustedWinRate,
          skillSpread: row.fact.skillSpread,
          signals: row.fact.signals,
          patchLines: row.fact.patchLines,
        })),
        null,
        2,
      ),
    ].join('\n');
    const raw = await completeExplanations(prompt, apiKey, model);
    const parsed = parseExplanations(raw, allowed);
    const whyByKey = new Map(parsed.map((row) => [`${row.slug}:${row.lane}`, row.why]));
    for (const row of batch) {
      const why = whyByKey.get(`${row.fact.slug}:${row.fact.lane}`);
      if (!why) {
        console.warn(`No explanation returned for ${row.fact.name} ${row.fact.lane}.`);
        continue;
      }
      writtenRows.push({
        snapshotDate,
        championId: row.placement.championId,
        lane: row.placement.lane,
        rankBracket: bracket,
        ruleset,
        letter: row.placement.letter,
        model,
        promptHash: row.hash,
        why,
      });
    }
    console.log(
      `Explained ${Math.min(i + BATCH_SIZE, pending.length)} / ${pending.length} placements.`,
    );
  }

  const written = await upsertTierExplanations(writtenRows);
  console.log(`Stored ${written} tier explanations for ${snapshotDate} (${model}).`);
  return { snapshotDate, status: 'written', considered: pending.length, written };
}
