import {
  getChampionBySlug,
  getLatestPatch,
  getLatestSnapshotDate,
  getPatchAnalysis,
  getPreviousSnapshotDate,
  listChampions,
  listLatestTierPlacements,
  listPatchChanges,
  listWinRatesByChampion,
} from '@wild-rift-forge/database';
import {
  DEFAULT_RANK_BRACKET,
  TIER_LANES,
  type ChangeType,
  type PatchAnalysisPayload,
  type RankBracket,
  type TierLane,
} from '@wild-rift-forge/game-data';
import { abilitiesForChampion } from './abilities';
import { getStubCounters } from './stubs/counters';

const BRACKETS = new Set<RankBracket>([
  'all',
  'diamond_plus',
  'master_plus',
  'challenger_plus',
  'legendary',
]);

export function parseBracket(value: unknown): RankBracket {
  const raw = typeof value === 'string' ? value : '';
  return BRACKETS.has(raw as RankBracket) ? (raw as RankBracket) : DEFAULT_RANK_BRACKET;
}

export function parseLane(value: unknown): TierLane | undefined {
  const raw = typeof value === 'string' ? value : '';
  if (!raw || raw === 'All') {
    return undefined;
  }
  return TIER_LANES.includes(raw as TierLane) ? (raw as TierLane) : undefined;
}

function bracketLabel(bracket: RankBracket): string {
  if (bracket === 'diamond_plus') {
    return 'CN Diamond+ ranked stats';
  }
  if (bracket === 'master_plus') {
    return 'CN Master+ ranked stats';
  }
  if (bracket === 'challenger_plus') {
    return 'CN Challenger+ ranked stats';
  }
  if (bracket === 'legendary') {
    return 'CN Legendary ranked stats';
  }
  return 'CN all-ranks stats';
}

export async function getChampionsPayload() {
  try {
    const champions = await listChampions();
    return { champions };
  } catch (err) {
    console.warn('listChampions failed:', err instanceof Error ? err.message : err);
    return { champions: [] };
  }
}

export async function getChampionPayload(slug: string) {
  try {
    const champion = await getChampionBySlug(slug);
    if (!champion) {
      return null;
    }
    const abilities = await abilitiesForChampion(champion.id);
    return { champion: { ...champion, abilities } };
  } catch (err) {
    console.warn('getChampionBySlug failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

interface ChampionArt {
  imageUrl: string | null;
  thumbnailUrl: string | null;
}

async function championImageMap(): Promise<Map<string, ChampionArt>> {
  try {
    const champions = await listChampions();
    return new Map(
      champions.map((champion) => [
        champion.slug,
        {
          imageUrl: champion.imageUrl,
          thumbnailUrl: champion.thumbnailUrl,
        },
      ]),
    );
  } catch (err) {
    console.warn('listChampions failed:', err instanceof Error ? err.message : err);
    return new Map();
  }
}

function withArt<T extends { slug: string }>(
  rows: T[],
  images: Map<string, ChampionArt>,
): Array<T & ChampionArt> {
  return rows.map((row) => {
    const art = images.get(row.slug);
    return {
      ...row,
      imageUrl: art?.imageUrl ?? null,
      thumbnailUrl: art?.thumbnailUrl ?? null,
    };
  });
}

export async function getCountersPayload(slug: string) {
  let champion: Awaited<ReturnType<typeof getChampionBySlug>> = null;
  try {
    champion = await getChampionBySlug(slug);
  } catch (err) {
    console.warn('getChampionBySlug failed:', err instanceof Error ? err.message : err);
  }

  const images = await championImageMap();
  const enemyName = champion?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const counters = getStubCounters(slug, enemyName);
  const abilities = champion ? await abilitiesForChampion(champion.id) : [];

  return {
    ...counters,
    picks: withArt(counters.picks, images),
    also: withArt(counters.also, images),
    abilities,
    enemy: champion
      ? {
          slug: champion.slug,
          name: champion.name,
          title: champion.title,
          roles: champion.roles,
          imageUrl: champion.imageUrl,
          thumbnailUrl: champion.thumbnailUrl,
        }
      : {
          slug,
          name: enemyName,
          title: null,
          roles: [] as string[],
          imageUrl: null as string | null,
          thumbnailUrl: null as string | null,
        },
  };
}

export async function getTiersPayload(query: { bracket?: unknown; lane?: unknown } = {}) {
  const bracket = parseBracket(query.bracket);
  const lane = parseLane(query.lane);
  try {
    const [{ snapshotDate, placements }, patch] = await Promise.all([
      listLatestTierPlacements(bracket, lane),
      getLatestPatch(),
    ]);
    return {
      bracket,
      lane: lane ?? 'All',
      snapshotDate: snapshotDate || null,
      patchVersion: patch?.version ?? null,
      sourceLabel: bracketLabel(bracket),
      placements,
    };
  } catch (err) {
    console.warn('listLatestTierPlacements failed:', err instanceof Error ? err.message : err);
    return {
      bracket,
      lane: lane ?? 'All',
      snapshotDate: null,
      patchVersion: null,
      sourceLabel: bracketLabel(bracket),
      placements: [],
    };
  }
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchSlug(name: string, roster: Array<{ slug: string; name: string }>): string {
  const key = compact(name);
  const hit = roster.find(
    (champion) => compact(champion.slug) === key || compact(champion.name) === key,
  );
  if (hit) {
    return hit.slug;
  }
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function groupKind(types: ChangeType[]): 'BUFF' | 'NERF' | 'ADJUST' {
  if (types.length > 0 && types.every((type) => type === 'buff')) {
    return 'BUFF';
  }
  if (types.length > 0 && types.every((type) => type === 'nerf')) {
    return 'NERF';
  }
  return 'ADJUST';
}

function lineKey(ability: string | null): string {
  if (!ability) {
    return '—';
  }
  if (/base stats/i.test(ability)) {
    return 'Base';
  }
  if (/^passive$/i.test(ability)) {
    return 'P';
  }
  return ability.slice(0, 1).toUpperCase();
}

function asAnalysis(payload: Record<string, unknown> | null): PatchAnalysisPayload | null {
  if (!payload || typeof payload.lede !== 'string') {
    return null;
  }
  const watch = Array.isArray(payload.watch) ? payload.watch : [];
  const movers = Array.isArray(payload.movers) ? payload.movers : [];
  return {
    lede: payload.lede,
    watch: watch.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const row = item as { slug?: unknown; why?: unknown };
      if (typeof row.slug !== 'string' || typeof row.why !== 'string') {
        return [];
      }
      return [{ slug: row.slug, why: row.why }];
    }),
    movers: movers.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const row = item as { slug?: unknown; direction?: unknown; note?: unknown };
      if (
        typeof row.slug !== 'string' ||
        (row.direction !== 'up' && row.direction !== 'down') ||
        typeof row.note !== 'string'
      ) {
        return [];
      }
      return [{ slug: row.slug, direction: row.direction, note: row.note }];
    }),
  };
}

export async function getLatestPatchPayload() {
  const patch = await getLatestPatch();
  if (!patch) {
    return null;
  }
  const [changes, analysisRow, roster, latestDate] = await Promise.all([
    listPatchChanges(patch.id),
    getPatchAnalysis(patch.id),
    listChampions(),
    getLatestSnapshotDate('diamond_plus'),
  ]);
  const prevDate = latestDate ? await getPreviousSnapshotDate('diamond_plus', latestDate) : null;
  const latestRates = latestDate
    ? await listWinRatesByChampion(latestDate, 'diamond_plus')
    : new Map();
  const prevRates = prevDate ? await listWinRatesByChampion(prevDate, 'diamond_plus') : new Map();

  const grouped = new Map<
    string,
    { name: string; slug: string; kinds: ChangeType[]; lines: Array<{ k: string; t: string }> }
  >();
  const items: string[] = [];
  for (const change of changes) {
    if (change.entityType !== 'champion') {
      const text = [change.entityName, change.description].filter(Boolean).join(': ');
      if (text) {
        items.push(text);
      }
      continue;
    }
    const slug = matchSlug(change.entityName, roster);
    const current = grouped.get(slug) ?? {
      name: change.entityName,
      slug,
      kinds: [],
      lines: [],
    };
    current.kinds.push(change.changeType);
    const text = [change.property, change.description].filter(Boolean).join(': ');
    if (text) {
      current.lines.push({ k: lineKey(change.ability), t: text });
    }
    grouped.set(slug, current);
  }

  const champions = [...grouped.values()].map((group) => {
    const current = latestRates.get(group.slug);
    const previous = prevRates.get(group.slug);
    const wrShift =
      current && previous ? Number((current.winRate - previous.winRate).toFixed(1)) : null;
    return {
      name: group.name,
      slug: group.slug,
      kind: groupKind(group.kinds),
      wr: current ? `${current.winRate.toFixed(1)}%` : null,
      wrShift,
      lines: group.lines.slice(0, 6),
    };
  });

  const rebuilding = !latestDate || Boolean(patch.releaseDate && latestDate < patch.releaseDate.slice(0, 10));

  return {
    patch,
    analysis: asAnalysis(analysisRow?.payload ?? null),
    rebuilding,
    statsAsOf: latestDate,
    champions,
    items,
  };
}
