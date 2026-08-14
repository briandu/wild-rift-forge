import {
  getChampionBySlug,
  getLatestPatch,
  getLatestSnapshotDate,
  getPatchAnalysis,
  getPreviousSnapshotDate,
  listAbilitiesBySlug,
  listChampions,
  listIconSignatures,
  listLatestLaneStats,
  listLatestTierPlacements,
  listPatchChanges,
  listWinRatesByChampion,
} from '@wild-rift-forge/database';
import {
  DEFAULT_RANK_BRACKET,
  TIER_LANES,
  buildLaneCounters,
  formatWinRate,
  matchupVerdict,
  type ChangeType,
  type PatchAnalysisPayload,
  type RankBracket,
  type TierLane,
} from '@wild-rift-forge/game-data';
import { abilitiesForChampion, toAbilityDtos } from './abilities';

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

/**
 * Reference library for browser-side champion-select recognition.
 *
 * Flat and slug-keyed so the client can hand it straight to the matcher, and small
 * enough (a hash and a colour signature per champion) to cache aggressively.
 */
export async function getIconSignaturesPayload() {
  try {
    const signatures = await listIconSignatures();
    return {
      hashAlgo: 'dhash8x8',
      signatures: signatures.map((row) => ({
        slug: row.slug,
        variant: row.variant,
        hash: row.hashBits,
        color: row.colorBits,
      })),
    };
  } catch (err) {
    console.warn('listIconSignatures failed:', err instanceof Error ? err.message : err);
    return { hashAlgo: 'dhash8x8', signatures: [] };
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

function laneLabel(lane: TierLane): string {
  if (lane === 'Jungle') return 'JUNGLE';
  return `${lane.toUpperCase()} LANE`;
}

export async function getCountersPayload(slug: string, query: { lane?: unknown } = {}) {
  let champion: Awaited<ReturnType<typeof getChampionBySlug>> = null;
  try {
    champion = await getChampionBySlug(slug);
  } catch (err) {
    console.warn('getChampionBySlug failed:', err instanceof Error ? err.message : err);
  }

  const enemyName = champion?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const abilities = champion ? await abilitiesForChampion(champion.id) : [];
  const enemy = champion
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
      };

  const preferredLane = parseLane(query.lane);
  try {
    const { snapshotDate, rows } = await listLatestLaneStats(DEFAULT_RANK_BRACKET);
    if (rows.length > 0) {
      const built = buildLaneCounters(slug, rows, preferredLane);
      const enemyRow = built.enemy;
      const wr = enemyRow?.winRate;
      const pr = enemyRow?.pickRate;
      const br = enemyRow?.banRate;
      const notes = enemyRow
        ? [
            `${enemyName} sits at ${formatWinRate(enemyRow.winRate)} win rate in ${built.lane} on the latest CN Diamond+ snapshot.`,
            enemyRow.pickRate >= 10
              ? `Picked in ${formatWinRate(enemyRow.pickRate)} of games — expect to see it.`
              : `Only ${formatWinRate(enemyRow.pickRate)} pick rate, so the sample is thinner than a staple.`,
            `Scores are lane win-rate gaps this patch, not pairwise matchup data.`,
          ]
        : [
            `${enemyName} has no row in this lane snapshot. Rankings below are the current ${built.lane} field.`,
            'Scores are lane win-rate gaps this patch, not pairwise matchup data.',
          ];
      return {
        stub: false,
        enemySlug: slug,
        enemyName,
        lane: laneLabel(built.lane),
        games: snapshotDate ? `Snapshot ${snapshotDate}` : 'Latest snapshot',
        blurb: enemyRow
          ? `${enemyName} is ${formatWinRate(enemyRow.winRate)} in ${built.lane}. Picks below are the lane mates winning more often this patch.`
          : `No ${built.lane} snapshot for ${enemyName}. These are the strongest picks in that lane.`,
        stats: [
          { value: wr != null ? formatWinRate(wr) : '—', label: 'WIN RATE' },
          { value: pr != null ? formatWinRate(pr) : '—', label: 'PICK RATE' },
          { value: br != null ? formatWinRate(br) : '—', label: 'BAN RATE' },
        ],
        notes,
        picks: built.picks,
        also: built.also,
        beats: built.beats,
        thin: !enemyRow,
        abilities,
        enemy,
      };
    }
  } catch (err) {
    console.warn('listLatestLaneStats failed:', err instanceof Error ? err.message : err);
  }

  return {
    stub: false,
    enemySlug: slug,
    enemyName,
    lane: preferredLane ? laneLabel(preferredLane) : 'TOP LANE',
    games: 'No ranked snapshot yet',
    blurb: `${enemyName} has no CN Diamond+ lane snapshot yet. We will not invent counter scores.`,
    stats: [
      { value: '—', label: 'WIN RATE' },
      { value: '—', label: 'PICK RATE' },
      { value: '—', label: 'BAN RATE' },
    ],
    notes: ['Scores need a ranked snapshot. We will not invent them.'],
    picks: [],
    also: [],
    beats: [],
    thin: true,
    abilities,
    enemy,
  };
}

export async function getMatchupPayload(query: { you?: unknown; them?: unknown; lane?: unknown }) {
  const youSlug = typeof query.you === 'string' ? query.you : '';
  const themSlug = typeof query.them === 'string' ? query.them : '';
  if (!youSlug || !themSlug) {
    return null;
  }
  const preferredLane = parseLane(query.lane);
  const [youChamp, themChamp] = await Promise.all([
    getChampionBySlug(youSlug).catch(() => null),
    getChampionBySlug(themSlug).catch(() => null),
  ]);
  if (!youChamp || !themChamp) {
    return null;
  }

  let snapshotDate: string | null = null;
  let rows: Awaited<ReturnType<typeof listLatestLaneStats>>['rows'] = [];
  try {
    const latest = await listLatestLaneStats(DEFAULT_RANK_BRACKET);
    snapshotDate = latest.snapshotDate || null;
    rows = latest.rows;
  } catch (err) {
    console.warn('listLatestLaneStats failed:', err instanceof Error ? err.message : err);
  }

  const lane =
    preferredLane ??
    buildLaneCounters(themSlug, rows).lane ??
    'Top';
  const youRow = rows.find((row) => row.slug === youSlug && row.lane === lane);
  const themRow = rows.find((row) => row.slug === themSlug && row.lane === lane);
  const youWr = youRow?.winRate ?? 50;
  const themWr = themRow?.winRate ?? 50;
  const verdict = matchupVerdict(youWr, themWr);
  const [youAbilities, themAbilities] = await Promise.all([
    abilitiesForChampion(youChamp.id),
    abilitiesForChampion(themChamp.id),
  ]);

  const sideLabel =
    verdict.side === 'you'
      ? `${youChamp.name} favoured`
      : verdict.side === 'them'
        ? `${themChamp.name} favoured`
        : 'Even matchup';

  return {
    you: {
      slug: youChamp.slug,
      name: youChamp.name,
      title: youChamp.title,
      roles: youChamp.roles,
      imageUrl: youChamp.imageUrl,
      thumbnailUrl: youChamp.thumbnailUrl,
      winRate: youRow ? formatWinRate(youRow.winRate) : null,
      pickRate: youRow ? formatWinRate(youRow.pickRate) : null,
    },
    them: {
      slug: themChamp.slug,
      name: themChamp.name,
      title: themChamp.title,
      roles: themChamp.roles,
      imageUrl: themChamp.imageUrl,
      thumbnailUrl: themChamp.thumbnailUrl,
      winRate: themRow ? formatWinRate(themRow.winRate) : null,
      pickRate: themRow ? formatWinRate(themRow.pickRate) : null,
    },
    lane,
    side: verdict.side,
    verdict: sideLabel,
    difficulty: verdict.difficulty,
    score: verdict.score,
    confidence: snapshotDate ? 'Lane win rates this snapshot' : 'No snapshot yet',
    sample: snapshotDate
      ? `CN Diamond+ snapshot ${snapshotDate}`
      : 'Pairwise games are not in the dataset yet',
    freshness: snapshotDate
      ? `Lane rates from ${snapshotDate}. Not a head-to-head sample.`
      : 'Waiting on the next stats ingest.',
    abilitiesYou: youAbilities,
    abilitiesThem: themAbilities,
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

function lineText(property: string | null, description: string | null): string {
  const prop = property?.trim() ?? '';
  const desc = description?.trim() ?? '';
  if (!prop) {
    return desc;
  }
  if (!desc || desc.toLowerCase().startsWith(prop.toLowerCase())) {
    return desc || prop;
  }
  return `${prop}: ${desc}`;
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
  const [changes, analysisRow, roster, latestDate, kits] = await Promise.all([
    listPatchChanges(patch.id),
    getPatchAnalysis(patch.id),
    listChampions(),
    getLatestSnapshotDate('diamond_plus'),
    listAbilitiesBySlug(),
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
      if (change.entityType === 'item' || change.entityType === 'rune') {
        const text = lineText(change.entityName, change.description);
        if (text) {
          items.push(text);
        }
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
    const text = lineText(change.property, change.description);
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
      abilities: toAbilityDtos(kits.get(group.slug) ?? []),
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
