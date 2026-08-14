import type { TierLane } from '@wild-rift-forge/game-data';
import { getPool } from './client';

export interface MatchupGuidePhase {
  n: string;
  t: string;
  body: string;
}

export interface MatchupGuideTrades {
  good: { steps: string[]; out: string };
  bad: { steps: string[]; out: string };
}

export interface MatchupGuideAbilityNote {
  own: boolean;
  k: string;
  when: string;
  then: string;
  win: string;
  note: string;
}

export interface MatchupGuideSpike {
  at: string;
  who: 'you' | 'them' | 'even';
  label: string;
}

export interface MatchupGuideContent {
  oneThing: string;
  style: string;
  stylePos: number;
  phases: MatchupGuidePhase[];
  trades: MatchupGuideTrades;
  mistakes: string[];
  tags: string[];
  abilityNotes: MatchupGuideAbilityNote[];
  spikes: MatchupGuideSpike[];
}

export interface StoredMatchupGuide extends MatchupGuideContent {
  youChampionId: number;
  themChampionId: number;
  lane: TierLane;
  patchVersion: string | null;
  kitHash: string;
  contextHash: string;
  model: string;
  promptVersion: number;
  updatedAt: string;
}

export interface MatchupGuideInput extends MatchupGuideContent {
  youChampionId: number;
  themChampionId: number;
  lane: TierLane;
  patchVersion: string | null;
  kitHash: string;
  contextHash: string;
  model: string;
  promptVersion: number;
}

export interface MatchupGuideRequest {
  youChampionId: number;
  themChampionId: number;
  youSlug: string;
  themSlug: string;
  lane: TierLane;
  requestedAt: string;
}

function asPhases(value: unknown): MatchupGuidePhase[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as { n?: unknown; t?: unknown; body?: unknown };
    if (typeof row.n !== 'string' || typeof row.t !== 'string' || typeof row.body !== 'string') {
      return [];
    }
    return [{ n: row.n, t: row.t, body: row.body }];
  });
}

function asTradeSide(value: unknown): { steps: string[]; out: string } {
  if (!value || typeof value !== 'object') {
    return { steps: [], out: '' };
  }
  const row = value as { steps?: unknown; out?: unknown };
  const steps = Array.isArray(row.steps)
    ? row.steps.filter((step): step is string => typeof step === 'string')
    : [];
  return { steps, out: typeof row.out === 'string' ? row.out : '' };
}

function asSpikes(value: unknown): MatchupGuideSpike[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as { at?: unknown; who?: unknown; label?: unknown };
    if (typeof row.at !== 'string' || typeof row.label !== 'string') {
      return [];
    }
    if (row.who !== 'you' && row.who !== 'them' && row.who !== 'even') {
      return [];
    }
    return [{ at: row.at, who: row.who, label: row.label }];
  });
}

function asAbilityNotes(value: unknown): MatchupGuideAbilityNote[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as {
      own?: unknown;
      k?: unknown;
      when?: unknown;
      then?: unknown;
      win?: unknown;
      note?: unknown;
    };
    if (
      typeof row.own !== 'boolean' ||
      typeof row.k !== 'string' ||
      typeof row.when !== 'string' ||
      typeof row.then !== 'string' ||
      typeof row.win !== 'string' ||
      typeof row.note !== 'string'
    ) {
      return [];
    }
    return [
      {
        own: row.own,
        k: row.k,
        when: row.when,
        then: row.then,
        win: row.win,
        note: row.note,
      },
    ];
  });
}

function mapGuideRow(row: Record<string, unknown>): StoredMatchupGuide {
  const trades = (row.trades ?? {}) as { good?: unknown; bad?: unknown };
  return {
    youChampionId: row.you_champion_id as number,
    themChampionId: row.them_champion_id as number,
    lane: row.lane as TierLane,
    patchVersion: (row.patch_version as string) ?? null,
    kitHash: row.kit_hash as string,
    contextHash: row.context_hash as string,
    model: row.model as string,
    promptVersion: row.prompt_version as number,
    oneThing: row.one_thing as string,
    style: row.style as string,
    stylePos: row.style_pos as number,
    phases: asPhases(row.phases),
    trades: {
      good: asTradeSide(trades.good),
      bad: asTradeSide(trades.bad),
    },
    mistakes: Array.isArray(row.mistakes)
      ? row.mistakes.filter((item): item is string => typeof item === 'string')
      : [],
    tags: Array.isArray(row.tags)
      ? row.tags.filter((item): item is string => typeof item === 'string')
      : [],
    abilityNotes: asAbilityNotes(row.ability_notes),
    spikes: asSpikes(row.spikes),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function getMatchupGuide(
  youChampionId: number,
  themChampionId: number,
  lane: TierLane,
): Promise<StoredMatchupGuide | null> {
  const result = await getPool().query(
    `SELECT you_champion_id, them_champion_id, lane, patch_version, kit_hash, context_hash,
            model, prompt_version, one_thing, style, style_pos, phases, trades, mistakes,
            tags, ability_notes, spikes, updated_at
     FROM matchup_guides
     WHERE you_champion_id = $1 AND them_champion_id = $2 AND lane = $3`,
    [youChampionId, themChampionId, lane],
  );
  const row = result.rows[0];
  return row ? mapGuideRow(row) : null;
}

export async function upsertMatchupGuide(input: MatchupGuideInput): Promise<void> {
  await getPool().query(
    `INSERT INTO matchup_guides (
       you_champion_id, them_champion_id, lane, patch_version, kit_hash, context_hash,
       model, prompt_version, one_thing, style, style_pos, phases, trades, mistakes, tags,
       ability_notes, spikes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (you_champion_id, them_champion_id, lane)
     DO UPDATE SET
       patch_version = EXCLUDED.patch_version,
       kit_hash = EXCLUDED.kit_hash,
       context_hash = EXCLUDED.context_hash,
       model = EXCLUDED.model,
       prompt_version = EXCLUDED.prompt_version,
       one_thing = EXCLUDED.one_thing,
       style = EXCLUDED.style,
       style_pos = EXCLUDED.style_pos,
       phases = EXCLUDED.phases,
       trades = EXCLUDED.trades,
       mistakes = EXCLUDED.mistakes,
       tags = EXCLUDED.tags,
       ability_notes = EXCLUDED.ability_notes,
       spikes = EXCLUDED.spikes,
       updated_at = now()`,
    [
      input.youChampionId,
      input.themChampionId,
      input.lane,
      input.patchVersion,
      input.kitHash,
      input.contextHash,
      input.model,
      input.promptVersion,
      input.oneThing,
      input.style,
      input.stylePos,
      JSON.stringify(input.phases),
      JSON.stringify(input.trades),
      JSON.stringify(input.mistakes),
      JSON.stringify(input.tags),
      JSON.stringify(input.abilityNotes),
      JSON.stringify(input.spikes),
    ],
  );
}

export async function requestMatchupGuide(
  youChampionId: number,
  themChampionId: number,
  lane: TierLane,
): Promise<void> {
  await getPool().query(
    `INSERT INTO matchup_guide_requests (you_champion_id, them_champion_id, lane)
     VALUES ($1, $2, $3)
     ON CONFLICT (you_champion_id, them_champion_id, lane) DO NOTHING`,
    [youChampionId, themChampionId, lane],
  );
}

const STALE_CLAIM = "interval '10 minutes'";

export async function listPendingMatchupRequests(limit = 10): Promise<MatchupGuideRequest[]> {
  const result = await getPool().query(
    `SELECT r.you_champion_id, r.them_champion_id, r.lane, r.requested_at,
            you.slug AS you_slug, them.slug AS them_slug
     FROM matchup_guide_requests r
     JOIN champions you ON you.id = r.you_champion_id
     JOIN champions them ON them.id = r.them_champion_id
     WHERE r.generated_at IS NULL
       AND (r.started_at IS NULL OR r.started_at < now() - ${STALE_CLAIM})
     ORDER BY r.requested_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    youChampionId: row.you_champion_id as number,
    themChampionId: row.them_champion_id as number,
    youSlug: row.you_slug as string,
    themSlug: row.them_slug as string,
    lane: row.lane as TierLane,
    requestedAt: new Date(row.requested_at as string).toISOString(),
  }));
}

export async function markMatchupRequestGenerated(
  youChampionId: number,
  themChampionId: number,
  lane: TierLane,
): Promise<void> {
  await getPool().query(
    `UPDATE matchup_guide_requests
     SET generated_at = now()
     WHERE you_champion_id = $1 AND them_champion_id = $2 AND lane = $3`,
    [youChampionId, themChampionId, lane],
  );
}

export async function countInFlightMatchupGenerations(): Promise<number> {
  const result = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n
     FROM matchup_guide_requests
     WHERE generated_at IS NULL
       AND started_at IS NOT NULL
       AND started_at >= now() - ${STALE_CLAIM}`,
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function claimMatchupGuideRequest(
  youChampionId: number,
  themChampionId: number,
  lane: TierLane,
): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE matchup_guide_requests
     SET started_at = now()
     WHERE you_champion_id = $1 AND them_champion_id = $2 AND lane = $3
       AND generated_at IS NULL
       AND (started_at IS NULL OR started_at < now() - ${STALE_CLAIM})
     RETURNING id`,
    [youChampionId, themChampionId, lane],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function releaseMatchupGuideClaim(
  youChampionId: number,
  themChampionId: number,
  lane: TierLane,
): Promise<void> {
  await getPool().query(
    `UPDATE matchup_guide_requests
     SET started_at = NULL
     WHERE you_champion_id = $1 AND them_champion_id = $2 AND lane = $3
       AND generated_at IS NULL`,
    [youChampionId, themChampionId, lane],
  );
}

export type MatchupGenerationReserve =
  | { ok: true; dayCalls: number; hourCalls: number }
  | { ok: false; reason: 'day' | 'hour' };

/**
 * Atomically take one OpenAI slot for the current UTC hour and day.
 * Returns ok:false without incrementing if either cap is already full.
 */
export async function tryReserveMatchupGenerationCall(limits: {
  day: number;
  hour: number;
}): Promise<MatchupGenerationReserve> {
  if (limits.day <= 0) {
    return { ok: false, reason: 'day' };
  }
  if (limits.hour <= 0) {
    return { ok: false, reason: 'hour' };
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const day = await client.query<{ calls: number }>(
      `INSERT INTO matchup_generation_usage (period, bucket_start, calls)
       VALUES ('day', date_trunc('day', timezone('utc', now())), 1)
       ON CONFLICT (period, bucket_start)
       DO UPDATE SET
         calls = matchup_generation_usage.calls + 1,
         updated_at = now()
       WHERE matchup_generation_usage.calls < $1
       RETURNING calls`,
      [limits.day],
    );
    if (!day.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'day' };
    }
    const hour = await client.query<{ calls: number }>(
      `INSERT INTO matchup_generation_usage (period, bucket_start, calls)
       VALUES ('hour', date_trunc('hour', timezone('utc', now())), 1)
       ON CONFLICT (period, bucket_start)
       DO UPDATE SET
         calls = matchup_generation_usage.calls + 1,
         updated_at = now()
       WHERE matchup_generation_usage.calls < $1
       RETURNING calls`,
      [limits.hour],
    );
    if (!hour.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'hour' };
    }
    await client.query('COMMIT');
    return { ok: true, dayCalls: day.rows[0].calls, hourCalls: hour.rows[0].calls };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
