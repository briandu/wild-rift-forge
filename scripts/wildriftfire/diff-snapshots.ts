import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { wrfChampionSchema, type WrfChampion } from '@wild-rift-forge/game-data';
import { DATA_ROOT, reportsDir } from './paths';

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function loadDir(dir: string): Promise<Map<string, WrfChampion>> {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
  const map = new Map<string, WrfChampion>();
  for (const file of files) {
    const parsed = wrfChampionSchema.safeParse(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
    if (parsed.success) {
      map.set(parsed.data.id, parsed.data);
    }
  }
  return map;
}

function flatten(value: unknown, prefix = ''): Array<{ path: string; value: unknown }> {
  if (value == null || typeof value !== 'object') {
    return [{ path: prefix, value }];
  }
  if (Array.isArray(value)) {
    return [{ path: prefix, value }];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const IGNORE = new Set(['source.scrapedAt', 'parseWarnings']);

export async function runDiff(): Promise<void> {
  const from = getFlag('from');
  const to = getFlag('to') ?? path.join(DATA_ROOT, 'normalized', 'champions');
  if (!from) {
    console.error('Usage: npm run wrf:diff -- --from data/normalized/champions-prev --to data/normalized/champions');
    process.exitCode = 1;
    return;
  }
  const before = await loadDir(from);
  const after = await loadDir(to);
  const changes: Array<{ champion: string; path: string; before: unknown; after: unknown }> = [];
  const structural: string[] = [];

  for (const [id, next] of after) {
    const prev = before.get(id);
    if (!prev) {
      structural.push(id);
      continue;
    }
    const prevMap = new Map(flatten(prev).map((row) => [row.path, row.value]));
    for (const row of flatten(next)) {
      if (IGNORE.has(row.path) || row.path.startsWith('gaps') || row.path.startsWith('parseWarnings')) {
        continue;
      }
      const old = prevMap.get(row.path);
      if (JSON.stringify(old) !== JSON.stringify(row.value)) {
        changes.push({ champion: id, path: row.path, before: old, after: row.value });
      }
    }
  }

  const major = new Set(changes.filter((change) => change.path.startsWith('abilities.')).map((change) => change.champion));
  const requireReview = after.size > 0 && major.size / after.size > 0.2;
  const report = {
    from,
    to,
    changedPaths: changes.length,
    championsChanged: new Set(changes.map((change) => change.champion)).size,
    newChampions: structural,
    requireReview,
    changes: changes.slice(0, 2000),
  };
  await writeFile(path.join(reportsDir(), 'wildriftfire-diff.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `${report.championsChanged} champions changed (${report.changedPaths} paths). requireReview=${requireReview}`,
  );
}

if (process.argv[1] && process.argv[1].includes('diff-snapshots')) {
  runDiff().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
