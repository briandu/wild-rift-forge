import type { RankBracket, TierLane } from '@wild-rift-forge/game-data';

/** Tencent position ids → our lane labels (verified against WildRiftFire Diamond+ tables). */
export const TENCENT_LANE_BY_POSITION: Record<string, TierLane> = {
  '1': 'Mid',
  '2': 'Top',
  '3': 'Dragon',
  '4': 'Support',
  '5': 'Jungle',
};

/** Tencent rank-band ids → our brackets (band 1 matches WildRiftFire Diamond+). */
export const TENCENT_BRACKET_BY_BAND: Record<string, RankBracket> = {
  '0': 'all',
  '1': 'diamond_plus',
  '2': 'master_plus',
  '3': 'challenger_plus',
  '4': 'legendary',
};

export interface TencentHeroRow {
  heroId: string;
  position: string;
  lane: TierLane;
  rankBracket: RankBracket;
  winRate: number;
  pickRate: number;
  banRate: number;
  strength: number | null;
  strengthLevel: number | null;
  snapshotDate: string;
}

function parsePercent(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value <= 1 ? value * 100 : value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const n = Number.parseFloat(value.replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseDate(dtstatdate: unknown): string | null {
  const raw = String(dtstatdate ?? '');
  if (!/^\d{8}$/.test(raw)) {
    return null;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function parseIntOrNull(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Flatten Tencent `hero_rank_list_v2` JSON into per-champion lane rows.
 */
export function parseTencentHeroRank(payload: unknown): TencentHeroRow[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const root = payload as { data?: unknown };
  if (!root.data || typeof root.data !== 'object') {
    return [];
  }
  const rows: TencentHeroRow[] = [];
  for (const [band, lanes] of Object.entries(root.data as Record<string, unknown>)) {
    const rankBracket = TENCENT_BRACKET_BY_BAND[band];
    if (!rankBracket || !lanes || typeof lanes !== 'object') {
      continue;
    }
    for (const [position, list] of Object.entries(lanes as Record<string, unknown>)) {
      const lane = TENCENT_LANE_BY_POSITION[position];
      if (!lane || !Array.isArray(list)) {
        continue;
      }
      for (const item of list) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const row = item as Record<string, unknown>;
        const heroId = String(row.hero_id ?? '').trim();
        const winRate = parsePercent(row.win_rate_percent ?? row.win_rate);
        const pickRate = parsePercent(row.appear_rate_percent ?? row.appear_rate);
        const banRate = parsePercent(row.forbid_rate_percent ?? row.forbid_rate);
        const snapshotDate = parseDate(row.dtstatdate);
        if (!heroId || winRate === null || pickRate === null || banRate === null || !snapshotDate) {
          continue;
        }
        rows.push({
          heroId,
          position,
          lane,
          rankBracket,
          winRate,
          pickRate,
          banRate,
          strength: parseIntOrNull(row.strength),
          strengthLevel: parseIntOrNull(row.strength_level),
          snapshotDate,
        });
      }
    }
  }
  return rows;
}

export interface Ry2xHeroStat {
  id: string;
  hero_id?: string | number;
  win_rate_percent?: string;
  appear_rate_percent?: string;
  forbid_rate_percent?: string;
  strength?: number;
  strength_level?: number;
}

const RY2X_LANE: Record<string, TierLane> = {
  mid: 'Mid',
  baron: 'Top',
  top: 'Top',
  duo: 'Dragon',
  ad: 'Dragon',
  dragon: 'Dragon',
  support: 'Support',
  jungle: 'Jungle',
};

const RY2X_BRACKET: Record<string, RankBracket> = {
  all: 'all',
  diamond_plus: 'diamond_plus',
  master_plus: 'master_plus',
  challenger_plus: 'challenger_plus',
  super_server: 'legendary',
  legendary: 'legendary',
};

/**
 * Flatten the ry2x merged stats JSON (fallback when Tencent is unreachable).
 */
export function parseRy2xHeroStats(payload: unknown): TencentHeroRow[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const root = payload as { date?: string; data?: unknown };
  const snapshotDate = root.date ? String(root.date).slice(0, 10) : null;
  if (!snapshotDate || !root.data || typeof root.data !== 'object') {
    return [];
  }
  const rows: TencentHeroRow[] = [];
  for (const [band, lanes] of Object.entries(root.data as Record<string, unknown>)) {
    const rankBracket = RY2X_BRACKET[band];
    if (!rankBracket || !lanes || typeof lanes !== 'object') {
      continue;
    }
    for (const [laneKey, list] of Object.entries(lanes as Record<string, unknown>)) {
      const lane = RY2X_LANE[laneKey.toLowerCase()];
      if (!lane || !Array.isArray(list)) {
        continue;
      }
      for (const item of list) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const row = item as Ry2xHeroStat;
        const winRate = parsePercent(row.win_rate_percent);
        const pickRate = parsePercent(row.appear_rate_percent);
        const banRate = parsePercent(row.forbid_rate_percent);
        const heroId = String(row.hero_id ?? '').trim();
        if (!row.id || winRate === null || pickRate === null || banRate === null) {
          continue;
        }
        rows.push({
          heroId: heroId && heroId !== '0' ? heroId : row.id,
          position: laneKey,
          lane,
          rankBracket,
          winRate,
          pickRate,
          banRate,
          strength: typeof row.strength === 'number' ? row.strength : null,
          strengthLevel: typeof row.strength_level === 'number' ? row.strength_level : null,
          snapshotDate,
        });
      }
    }
  }
  return rows;
}
