import { createHash } from 'node:crypto';
import {
  getLatestPatch,
  getLatestSnapshotDate,
  listChampions,
  listLatestTierPlacements,
  listPatchChanges,
  listTierAdjustments,
  replaceTierAdjustments,
  type StoredTierPlacement,
  type TierAdjustmentInput,
} from '@wild-rift-forge/database';
import {
  applyLetterAdjustment,
  DEFAULT_RANK_BRACKET,
  DEFAULT_TIER_RULESET,
  type RankBracket,
  type TierLane,
  type TierLetter,
  type TierRuleset,
} from '@wild-rift-forge/game-data';
import { matchHeroToRoster } from '../sources/tencent/hero-map';
import { explainModel } from './explain-tiers';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CANDIDATES = 40;
const MAX_MOVES = 20;

const REVIEW_SCHEMA = {
  name: 'tier_review',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['adjustments'],
    properties: {
      adjustments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slug', 'lane', 'direction', 'reason', 'confidence'],
          properties: {
            slug: { type: 'string' },
            lane: { type: 'string' },
            direction: { type: 'string', enum: ['up', 'down', 'keep'] },
            reason: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
    },
  },
} as const;

export type ReviewCandidate = {
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
  patchTouched: boolean;
};

export function pickReviewCandidates(
  placements: StoredTierPlacement[],
  patchSlugs: ReadonlySet<string>,
  limit = MAX_CANDIDATES,
): StoredTierPlacement[] {
  const scored = placements.map((row) => {
    let priority = 0;
    if (row.letter === 'S' || row.letter === 'C') {
      priority += 8;
    }
    if (patchSlugs.has(row.slug)) {
      priority += 6;
    }
    const adj = row.adjustedWinRate;
    if (adj != null && row.letter === 'S' && adj < 51.5) {
      priority += 5;
    }
    if (adj != null && row.letter === 'C' && adj > 50) {
      priority += 4;
    }
    if (row.skillSpread != null && Math.abs(row.skillSpread) >= 2) {
      priority += 3;
    }
    if (row.confidence != null && row.confidence < 0.45 && (row.letter === 'S' || row.letter === 'A')) {
      priority += 3;
    }
    return { row, priority };
  });
  return scored
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority || a.row.rankInLane - b.row.rankInLane)
    .slice(0, limit)
    .map((item) => item.row);
}

export function fingerprintReview(
  cycleKey: string,
  model: string,
  candidates: ReviewCandidate[],
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        cycleKey,
        model,
        candidates: candidates.map((row) => ({
          slug: row.slug,
          lane: row.lane,
          letter: row.letter,
          rankInLane: row.rankInLane,
          winRate: Number(row.winRate.toFixed(1)),
          pickRate: Number(row.pickRate.toFixed(1)),
          banRate: Number(row.banRate.toFixed(1)),
          adjustedWinRate: row.adjustedWinRate == null ? null : Number(row.adjustedWinRate.toFixed(1)),
          skillSpread: row.skillSpread == null ? null : Number(row.skillSpread.toFixed(1)),
          patchTouched: row.patchTouched,
        })),
      }),
    )
    .digest('hex');
}

export function parseReviewAdjustments(
  raw: unknown,
  allowed: ReadonlySet<string>,
): Array<{
  slug: string;
  lane: TierLane;
  direction: 'up' | 'down';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const body = raw as { adjustments?: unknown };
  const rows = Array.isArray(body.adjustments) ? body.adjustments : [];
  return rows.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as {
      slug?: unknown;
      lane?: unknown;
      direction?: unknown;
      reason?: unknown;
      confidence?: unknown;
    };
    const slug = typeof row.slug === 'string' ? row.slug : '';
    const lane = typeof row.lane === 'string' ? row.lane : '';
    const direction = row.direction === 'up' || row.direction === 'down' ? row.direction : null;
    const reason = typeof row.reason === 'string' ? row.reason.trim() : '';
    const confidence =
      row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
        ? row.confidence
        : 'medium';
    if (!allowed.has(`${slug}:${lane}`) || !direction || !reason) {
      return [];
    }
    return [{ slug, lane: lane as TierLane, direction, reason, confidence }];
  });
}

async function completeReview(prompt: string, apiKey: string, model: string): Promise<unknown> {
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
            'You review a Wild Rift tier list for a typical ranked player, not Challenger one-tricks. The baseline letters already use sample-size shrinkage and a skill-spread discount. Only move a champion when the letter looks wrong for that audience. At most one letter up or down. Prefer keep. Use only the facts. Do not invent rates. Slug and lane must match the candidate list.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: REVIEW_SCHEMA,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && detail.includes('insufficient_quota')) {
      throw new Error(
        'OpenAI rejected the request: this API key has no remaining quota. Add billing and re-run scrape:tiers-review.',
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

export interface ReviewTiersResult {
  cycleKey: string;
  status: 'written' | 'skipped' | 'missing-key';
  candidates: number;
  moves: number;
}

export async function reviewTierPlacements(options?: {
  bracket?: RankBracket;
  ruleset?: TierRuleset;
}): Promise<ReviewTiersResult> {
  const bracket = options?.bracket ?? DEFAULT_RANK_BRACKET;
  const ruleset = options?.ruleset ?? DEFAULT_TIER_RULESET;
  const model = explainModel();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const [snapshotDate, patch, roster] = await Promise.all([
    getLatestSnapshotDate(bracket),
    getLatestPatch(),
    listChampions(),
  ]);
  const cycleKey = patch?.version ?? snapshotDate ?? 'unknown';
  if (!snapshotDate) {
    console.log('No ranked snapshot stored. Run scrape:stats first.');
    return { cycleKey, status: 'skipped', candidates: 0, moves: 0 };
  }

  const [{ placements }, changes, existing] = await Promise.all([
    listLatestTierPlacements(bracket, undefined, ruleset),
    patch ? listPatchChanges(patch.id) : Promise.resolve([]),
    listTierAdjustments(cycleKey, ruleset),
  ]);
  const slugs = roster.map((champion) => champion.slug);
  const patchSlugs = new Set(
    changes.flatMap((change) => {
      if (change.entityType !== 'champion') {
        return [];
      }
      const slug = matchHeroToRoster(change.entityName, slugs);
      return slug ? [slug] : [];
    }),
  );
  const selected = pickReviewCandidates(placements, patchSlugs);
  const candidates: ReviewCandidate[] = selected.map((row) => ({
    slug: row.slug,
    name: row.name,
    lane: row.lane,
    letter: row.letter,
    rankInLane: row.rankInLane,
    winRate: row.winRate,
    pickRate: row.pickRate,
    banRate: row.banRate,
    adjustedWinRate: row.adjustedWinRate ?? null,
    skillSpread: row.skillSpread ?? null,
    confidence: row.confidence ?? null,
    patchTouched: patchSlugs.has(row.slug),
  }));
  const promptHash = fingerprintReview(cycleKey, model, candidates);
  if (existing.length > 0 && existing.every((row) => row.promptHash === promptHash)) {
    console.log(`Sol review for ${cycleKey} is current. Skipping OpenAI.`);
    return { cycleKey, status: 'skipped', candidates: candidates.length, moves: existing.length };
  }
  if (!apiKey) {
    console.log('OPENAI_API_KEY is not set — skipping Sol tier review.');
    return { cycleKey, status: 'missing-key', candidates: candidates.length, moves: 0 };
  }

  const allowed = new Set(candidates.map((row) => `${row.slug}:${row.lane}`));
  const prompt = [
    `Patch cycle ${cycleKey}. Baseline is ${ruleset} ${bracket}.`,
    `Review these ${candidates.length} candidates. Return keep unless a letter is wrong for a typical ranked player.`,
    `At most ${MAX_MOVES} up/down moves. One letter only.`,
    JSON.stringify(candidates, null, 2),
  ].join('\n');
  const raw = await completeReview(prompt, apiKey, model);
  const parsed = parseReviewAdjustments(raw, allowed).slice(0, MAX_MOVES);
  const byId = new Map(roster.map((champion) => [champion.slug, champion]));
  const byKey = new Map(selected.map((row) => [`${row.slug}:${row.lane}`, row]));
  const rows: TierAdjustmentInput[] = [];
  for (const move of parsed) {
    const champion = byId.get(move.slug);
    const baseline = byKey.get(`${move.slug}:${move.lane}`);
    if (!champion || !baseline) {
      continue;
    }
    const delta = move.direction === 'up' ? 1 : -1;
    const letterAfter = applyLetterAdjustment(baseline.letter, delta);
    if (letterAfter === baseline.letter) {
      continue;
    }
    rows.push({
      cycleKey,
      ruleset,
      championId: champion.id,
      lane: move.lane,
      delta,
      letterBefore: baseline.letter,
      letterAfter,
      reason: move.reason,
      confidence: move.confidence,
      model,
      promptHash,
    });
    console.log(
      `${baseline.name} ${move.lane} ${baseline.letter} → ${letterAfter} (${move.confidence}): ${move.reason}`,
    );
  }
  await replaceTierAdjustments(cycleKey, ruleset, rows);
  console.log(`Stored ${rows.length} Sol adjustments for ${cycleKey} (${model}).`);
  return { cycleKey, status: 'written', candidates: candidates.length, moves: rows.length };
}
