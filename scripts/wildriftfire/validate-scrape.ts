import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { wrfChampionSchema, type WrfChampion } from '@wild-rift-forge/game-data';
import { normalizedChampionPath, reportsDir, wrfIndexPath } from './paths';

async function loadChampions(): Promise<WrfChampion[]> {
  const dir = path.dirname(normalizedChampionPath('_'));
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  const champions: WrfChampion[] = [];
  for (const file of files) {
    const parsed = wrfChampionSchema.safeParse(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
    if (parsed.success) {
      champions.push(parsed.data);
    }
  }
  return champions;
}

export async function runValidate(): Promise<void> {
  const champions = await loadChampions();
  const index = JSON.parse(await readFile(wrfIndexPath(), 'utf8')) as Array<{ id: string }>;
  const ids = new Set(champions.map((champion) => champion.id));
  const errors: string[] = [];
  const missing = index.filter((entry) => !ids.has(entry.id)).map((entry) => entry.id);
  if (missing.length) {
    errors.push(`Index entries without a record: ${missing.join(', ')}`);
  }
  const seen = new Set<string>();
  for (const champion of champions) {
    if (seen.has(champion.id)) {
      errors.push(`Duplicate id ${champion.id}`);
    }
    seen.add(champion.id);
    if (!champion.name) errors.push(`${champion.id}: missing name`);
    if (!champion.source.url) errors.push(`${champion.id}: missing source URL`);
    if (!champion.source.provider) errors.push(`${champion.id}: missing source provider`);
    for (const slot of ['passive', 'q', 'w', 'e', 'r'] as const) {
      const ability = champion.abilities[slot];
      if (!ability?.name) errors.push(`${champion.id}: ${slot} missing name`);
    }
    const json = JSON.stringify(champion);
    if (json.includes('NaN')) {
      errors.push(`${champion.id}: contains NaN`);
    }
  }

  const report = {
    champions: champions.length,
    index: index.length,
    missingFromIndex: missing,
    errors,
    patches: [...new Set(champions.map((champion) => champion.source.observedPatch))],
    extraAbilityChampions: champions.filter((champion) => champion.extraAbilities.length > 0).map((c) => c.id),
  };
  await writeFile(path.join(reportsDir(), 'wildriftfire-validate.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].includes('validate-scrape')) {
  runValidate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
