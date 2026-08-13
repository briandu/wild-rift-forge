import {
  insertRawSource,
  insertStatSnapshots,
  listChampions,
  listSnapshotsForDate,
  replaceTierPlacements,
  type StatSnapshotInput,
  type TierPlacementInput,
} from '@wild-rift-forge/database';
import {
  assignTierLetter,
  championTierScore,
  TIER_LANES,
  tierBandCounts,
  type RankBracket,
} from '@wild-rift-forge/game-data';
import { fetchJson } from '../fetchers/fetch-json';
import { parseTencentHeroList, parseRy2xHeroMap } from '../sources/tencent/hero-list.parser';
import { matchHeroToRoster } from '../sources/tencent/hero-map';
import { parseRy2xHeroStats, parseTencentHeroRank } from '../sources/tencent/stats.parser';

export const TENCENT_STATS_URL = 'https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2';
export const TENCENT_HERO_LIST_URL =
  'https://game.gtimg.cn/images/lgamem/act/lrlib/js/heroList/hero_list.js';
export const RY2X_STATS_URL = 'https://ry2x.github.io/WildRift-Merged-Stats-Data/heroStats.json';
export const RY2X_HERO_MAP_URL = 'https://ry2x.github.io/WildRift-Champs/hero.json';

const PARSER_VERSION = '1.0.0';
const BRACKETS: RankBracket[] = [
  'all',
  'diamond_plus',
  'master_plus',
  'challenger_plus',
  'legendary',
];

export interface SyncStatsResult {
  source: string;
  snapshotDates: string[];
  mapped: number;
  unmatched: number;
  inserted: number;
}

async function loadHeroNames(): Promise<Map<string, string>> {
  try {
    const page = await fetchJson(TENCENT_HERO_LIST_URL);
    const map = parseTencentHeroList(page.data);
    if (map.size > 0) {
      return map;
    }
  } catch (error) {
    console.warn(`Tencent hero list failed: ${error instanceof Error ? error.message : error}`);
  }
  const fallback = await fetchJson(RY2X_HERO_MAP_URL);
  return parseRy2xHeroMap(fallback.data);
}

async function loadStatRows(): Promise<{
  rows: ReturnType<typeof parseTencentHeroRank>;
  sourceUrl: string;
  raw: { body: string; contentHash: string; contentType: string; url: string };
}> {
  try {
    const page = await fetchJson(TENCENT_STATS_URL);
    const rows = parseTencentHeroRank(page.data);
    if (rows.length === 0) {
      throw new Error('Tencent stats payload parsed to zero rows');
    }
    return {
      rows,
      sourceUrl: TENCENT_STATS_URL,
      raw: {
        body: page.body,
        contentHash: page.contentHash,
        contentType: page.contentType,
        url: page.url,
      },
    };
  } catch (error) {
    console.warn(`Tencent stats failed, trying ry2x fallback: ${error instanceof Error ? error.message : error}`);
    const page = await fetchJson(RY2X_STATS_URL);
    const rows = parseRy2xHeroStats(page.data);
    if (rows.length === 0) {
      throw new Error('No champion stats from Tencent or ry2x fallback');
    }
    return {
      rows,
      sourceUrl: RY2X_STATS_URL,
      raw: {
        body: page.body,
        contentHash: page.contentHash,
        contentType: page.contentType,
        url: page.url,
      },
    };
  }
}

function placementsFromSnapshots(
  snapshots: Awaited<ReturnType<typeof listSnapshotsForDate>>,
): TierPlacementInput[] {
  const out: TierPlacementInput[] = [];
  for (const lane of TIER_LANES) {
    const laneRows = snapshots
      .filter((row) => row.lane === lane)
      .map((row) => ({
        ...row,
        score: championTierScore(row.winRate, row.pickRate, row.banRate),
      }))
      .sort((a, b) => b.score - a.score || b.winRate - a.winRate);
    const counts = tierBandCounts(laneRows.length);
    laneRows.forEach((row, index) => {
      const rankInLane = index + 1;
      out.push({
        snapshotDate: row.snapshotDate,
        championId: row.championId,
        lane: row.lane,
        rankBracket: row.rankBracket,
        letter: assignTierLetter(rankInLane, counts),
        score: row.score,
        rankInLane,
        winRate: row.winRate,
        pickRate: row.pickRate,
        banRate: row.banRate,
      });
    });
  }
  return out;
}

export async function syncChampionStats(): Promise<SyncStatsResult> {
  const roster = await listChampions();
  if (roster.length === 0) {
    throw new Error('Champion roster is empty — run scrape:champions first');
  }
  const slugs = roster.map((champion) => champion.slug);
  const bySlug = new Map(roster.map((champion) => [champion.slug, champion]));

  const heroNames = await loadHeroNames();
  const { rows, sourceUrl, raw } = await loadStatRows();

  await insertRawSource({
    sourceType: 'tencent-hero-stats',
    url: raw.url,
    contentHash: raw.contentHash,
    contentType: raw.contentType,
    rawBody: raw.body,
    parserVersion: PARSER_VERSION,
  });

  const snapshots: StatSnapshotInput[] = [];
  const unmatchedIds = new Set<string>();
  for (const row of rows) {
    const heroName = heroNames.get(row.heroId) ?? (/^[A-Za-z]/.test(row.heroId) ? row.heroId : '');
    const slug = heroName ? matchHeroToRoster(heroName, slugs) : null;
    const champion = slug ? bySlug.get(slug) : undefined;
    if (!champion) {
      unmatchedIds.add(row.heroId);
      continue;
    }
    snapshots.push({
      snapshotDate: row.snapshotDate,
      championId: champion.id,
      lane: row.lane,
      rankBracket: row.rankBracket,
      winRate: row.winRate,
      pickRate: row.pickRate,
      banRate: row.banRate,
      tencentStrength: row.strength,
      tencentStrengthLevel: row.strengthLevel,
      sourceUrl,
    });
  }

  const inserted = await insertStatSnapshots(snapshots);
  const snapshotDates = [...new Set(snapshots.map((row) => row.snapshotDate))].sort();
  for (const snapshotDate of snapshotDates) {
    for (const bracket of BRACKETS) {
      const dayRows = await listSnapshotsForDate(snapshotDate, bracket);
      if (dayRows.length === 0) {
        continue;
      }
      await replaceTierPlacements(snapshotDate, bracket, placementsFromSnapshots(dayRows));
    }
  }

  console.log(
    `Stats sync from ${sourceUrl}: ${snapshots.length} mapped rows, ${inserted} inserted, ` +
      `${unmatchedIds.size} unmatched heroes, dates ${snapshotDates.join(', ') || 'none'}.`,
  );
  if (unmatchedIds.size > 0 && unmatchedIds.size <= 12) {
    console.log(`Unmatched hero ids: ${[...unmatchedIds].join(', ')}`);
  }
  return {
    source: sourceUrl,
    snapshotDates,
    mapped: snapshots.length,
    unmatched: unmatchedIds.size,
    inserted,
  };
}
