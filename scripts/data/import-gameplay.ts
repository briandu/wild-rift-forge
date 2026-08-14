import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  closePool,
  listChampions,
  upsertChampionAbilityGameplay,
  type StoredChampion,
} from '@wild-rift-forge/database';
import {
  ABILITY_SLOTS,
  championGameplaySnapshotSchema,
  championIdsMatch,
  DB_SLOT_BY_BASELINE,
  pickBaselineAbilityForSlot,
  slugFromOfficialUrl,
  SORT_ORDER_BY_BASELINE,
  type ChampionGameplaySnapshot,
} from '@wild-rift-forge/game-data';
import { normalizedDir, REPO_ROOT } from './lib/paths';

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

function loadEnv(): void {
  for (const candidate of [path.join(REPO_ROOT, '.env'), path.resolve('.env')]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // try the next candidate
    }
  }
}

function matchChampion(
  snapshot: ChampionGameplaySnapshot,
  champions: StoredChampion[],
): StoredChampion | undefined {
  const urlSlug = slugFromOfficialUrl(snapshot.officialChampionUrl);
  if (urlSlug) {
    const hit = champions.find((champion) => champion.slug === urlSlug);
    if (hit) {
      return hit;
    }
  }
  const byId = champions.filter((champion) => championIdsMatch(champion.slug, snapshot.id));
  if (byId.length === 1) {
    return byId[0];
  }
  const byName = champions.filter((champion) => championIdsMatch(champion.name, snapshot.name));
  return byName.length === 1 ? byName[0] : undefined;
}

export async function runGameplayImport(): Promise<void> {
  loadEnv();
  const patch = getFlag('patch') ?? '7.2c';
  const dir = normalizedDir(patch);
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  const champions = await listChampions();

  let updated = 0;
  let unmatched = 0;
  let extraForms = 0;
  const missing: string[] = [];

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    const snapshot = championGameplaySnapshotSchema.parse(raw);
    const champion = matchChampion(snapshot, champions);
    if (!champion) {
      unmatched += 1;
      missing.push(snapshot.id);
      continue;
    }

    for (const slot of ABILITY_SLOTS) {
      const ability = pickBaselineAbilityForSlot(snapshot.abilities, slot);
      if (!ability) {
        continue;
      }
      const sameSlot = snapshot.abilities.filter((row) => row.slot === slot);
      if (sameSlot.length > 1) {
        extraForms += sameSlot.length - 1;
      }
      await upsertChampionAbilityGameplay(champion.id, DB_SLOT_BY_BASELINE[slot], {
        name: ability.name,
        sortOrder: SORT_ORDER_BY_BASELINE[slot],
        cooldown: ability.cooldown.value,
        cost: ability.cost.value,
        numericSummary: ability.rawNumericSummary || null,
        snapshotPatch: snapshot.snapshotPatch,
        gameplaySource: ability.sourceQuality,
      });
      updated += 1;
    }
  }

  console.log(
    `Wrote gameplay onto ${updated} ability rows from ${files.length} snapshots (${patch}).`,
  );
  if (extraForms > 0) {
    console.log(`Skipped ${extraForms} extra form rows (Kayn and similar).`);
  }
  if (missing.length > 0) {
    console.log(`Unmatched snapshots (${missing.length}): ${missing.join(', ')}`);
  }
}

if (process.argv[1] && process.argv[1].includes('import-gameplay')) {
  runGameplayImport()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
