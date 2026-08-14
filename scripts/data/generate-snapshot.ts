import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { applyPatch, type ChampionGameplaySnapshot, type NormalizedPatchRecord } from '@wild-rift-forge/game-data';
import { normalizedDir, patchRecordPath } from './lib/paths';

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const fromPatch = getFlag('from') ?? '7.2c';
  const applyVersion = getFlag('apply');
  if (!applyVersion) {
    throw new Error('Usage: generate-snapshot.ts --from 7.2c --apply 7.2d');
  }
  const record = JSON.parse(await readFile(patchRecordPath(applyVersion), 'utf8')) as NormalizedPatchRecord;
  const sourceDir = normalizedDir(fromPatch);
  const destDir = normalizedDir(applyVersion);
  await mkdir(destDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.json'));
  let appliedChampions = 0;
  for (const file of files) {
    const snapshot = JSON.parse(await readFile(path.join(sourceDir, file), 'utf8')) as ChampionGameplaySnapshot;
    const changes = record.changes.filter(
      (change) => change.championId === snapshot.id || change.champion.toLowerCase() === snapshot.name.toLowerCase(),
    );
    const next = changes.length > 0 ? applyPatch(snapshot, changes, applyVersion).snapshot : snapshot;
    if (changes.length > 0) {
      appliedChampions += 1;
    }
    await writeFile(path.join(destDir, file), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }
  console.log(`Wrote ${files.length} snapshots to ${destDir} (${appliedChampions} received ${applyVersion} deltas)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
