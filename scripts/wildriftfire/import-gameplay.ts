import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  closePool,
  listChampions,
  upsertChampionAbilityGameplay,
  type StoredChampion,
} from '@wild-rift-forge/database';
import {
  DB_SLOT_BY_BASELINE,
  SORT_ORDER_BY_BASELINE,
  wrfChampionSchema,
  type WrfAbilitySlot,
  type WrfChampion,
} from '@wild-rift-forge/game-data';
import { normalizeChampionKey } from '../../apps/scraper/src/sources/wildriftfire/home.parser.ts';
import { normalizedChampionPath, REPO_ROOT } from './paths';

const SLOT_TO_BASELINE: Record<WrfAbilitySlot, 'P' | 'Q' | 'W' | 'E' | 'R'> = {
  passive: 'P',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
};

function loadEnv(): void {
  for (const candidate of [path.join(REPO_ROOT, '.env'), path.resolve('.env')]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // next
    }
  }
}

function matchChampion(snapshot: WrfChampion, champions: StoredChampion[]): StoredChampion | undefined {
  const byKey = champions.filter(
    (champion) => normalizeChampionKey(champion.slug) === normalizeChampionKey(snapshot.id),
  );
  if (byKey.length === 1) {
    return byKey[0];
  }
  const byName = champions.filter(
    (champion) => normalizeChampionKey(champion.name) === normalizeChampionKey(snapshot.name),
  );
  return byName.length === 1 ? byName[0] : undefined;
}

export async function runWrfGameplayImport(): Promise<void> {
  loadEnv();
  const dir = path.dirname(normalizedChampionPath('_'));
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  const roster = await listChampions();
  let updated = 0;
  const missing: string[] = [];

  for (const file of files) {
    const parsed = wrfChampionSchema.safeParse(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
    if (!parsed.success) {
      continue;
    }
    const snapshot = parsed.data;
    const champion = matchChampion(snapshot, roster);
    if (!champion) {
      missing.push(snapshot.id);
      continue;
    }
    for (const slot of ['passive', 'q', 'w', 'e', 'r'] as const) {
      const ability = snapshot.abilities[slot];
      const baselineSlot = SLOT_TO_BASELINE[slot];
      await upsertChampionAbilityGameplay(champion.id, DB_SLOT_BY_BASELINE[baselineSlot], {
        name: ability.name,
        sortOrder: SORT_ORDER_BY_BASELINE[baselineSlot],
        cooldown: ability.cooldown,
        cost: ability.cost,
        numericSummary: ability.rawParsedText || ability.description.normalized || null,
        snapshotPatch: snapshot.source.observedPatch ?? 'wildriftfire',
        gameplaySource: 'wildriftfire',
      });
      updated += 1;
    }
  }

  console.log(`Wrote WRF gameplay onto ${updated} ability rows from ${files.length} files.`);
  if (missing.length) {
    console.log(`Unmatched snapshots (${missing.length}): ${missing.join(', ')}`);
  }
}

if (process.argv[1] && process.argv[1].includes('import-gameplay')) {
  runWrfGameplayImport()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
