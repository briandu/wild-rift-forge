import {
  getLatestPatch,
  getLatestSnapshotDate,
  listChampions,
  listPatchChanges,
  listSnapshotsForDateAllBrackets,
} from '@wild-rift-forge/database';
import {
  DEFAULT_RANK_BRACKET,
  TIER_LANES,
  TIER_RULESET_BLENDED,
  TIER_RULESET_CN,
  type RankBracket,
} from '@wild-rift-forge/game-data';
import { matchHeroToRoster } from '../sources/tencent/hero-map';
import {
  championNudgesFromChanges,
  nudgeByChampionId,
  placementsFromBlended,
  placementsFromCnStats,
} from '../tiers/compute';

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : `${value}${' '.repeat(width - value.length)}`;
}

export async function previewTierDiff(bracket: RankBracket = DEFAULT_RANK_BRACKET): Promise<void> {
  const snapshotDate = await getLatestSnapshotDate(bracket);
  if (!snapshotDate) {
    console.log('No ranked snapshot stored. Run scrape:stats first.');
    return;
  }

  const [roster, snapshots, patch] = await Promise.all([
    listChampions(),
    listSnapshotsForDateAllBrackets(snapshotDate),
    getLatestPatch(),
  ]);
  const byId = new Map(roster.map((champion) => [champion.id, champion]));
  const changes = patch ? await listPatchChanges(patch.id) : [];
  const nudges = nudgeByChampionId(
    championNudgesFromChanges(changes, roster, matchHeroToRoster),
    patch?.releaseDate,
    snapshotDate,
  );

  const legacy = placementsFromCnStats(snapshots.filter((row) => row.rankBracket === bracket));
  const blended = placementsFromBlended({
    snapshots,
    bracket,
    previous: [],
    nudgeByChampion: nudges,
  });

  const legacyByKey = new Map(legacy.map((row) => [`${row.championId}:${row.lane}`, row]));
  let changesCount = 0;

  console.log(
    `Preview ${snapshotDate} ${bracket}: ${TIER_RULESET_CN} → ${TIER_RULESET_BLENDED}` +
      (patch ? ` (patch ${patch.version})` : ''),
  );

  for (const lane of TIER_LANES) {
    const rows = blended
      .filter((row) => row.lane === lane)
      .sort((a, b) => a.rankInLane - b.rankInLane);
    const diffs = rows.filter((row) => {
      const old = legacyByKey.get(`${row.championId}:${row.lane}`);
      return old && old.letter !== row.letter;
    });
    console.log(`\n${lane}  ${rows.length} champs, ${diffs.length} letter changes`);
    if (diffs.length === 0) {
      continue;
    }
    changesCount += diffs.length;
    for (const row of diffs) {
      const old = legacyByKey.get(`${row.championId}:${row.lane}`)!;
      const name = byId.get(row.championId)?.name ?? String(row.championId);
      const adj = row.adjustedWinRate == null ? '—' : row.adjustedWinRate.toFixed(1);
      const spread = row.skillSpread == null ? '—' : row.skillSpread.toFixed(1);
      const conf = row.confidence == null ? '—' : row.confidence.toFixed(2);
      console.log(
        `  ${pad(name, 18)} ${old.letter} → ${row.letter}   adjWR ${pad(adj, 5)}  spread ${pad(spread, 5)}  conf ${conf}`,
      );
    }
  }

  console.log(`\n${changesCount} letter changes across ${TIER_LANES.length} lanes.`);
}
