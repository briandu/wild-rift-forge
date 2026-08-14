import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  championGameplaySnapshotSchema,
  championIdFromName,
  normalizeAbilityName,
  normalizedPatchRecordSchema,
  type ChampionGameplaySnapshot,
  type NormalizedPatchRecord,
} from '@wild-rift-forge/game-data';
import { normalizedDir, patchRecordPath, reportsDir } from './lib/paths';

const EXPECTED_COUNT = 141;

interface Issue {
  level: 'error' | 'warning';
  champion?: string;
  message: string;
}

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

function sameNumericArray(left: Array<number | null> | null | undefined, right: unknown): boolean {
  if (!left || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function afterLooksApplied(snapshot: ChampionGameplaySnapshot, after: unknown): boolean {
  if (Array.isArray(after)) {
    if (snapshot.abilities.some((ability) => sameNumericArray(ability.cooldown.value, after))) {
      return true;
    }
    if (snapshot.abilities.some((ability) => sameNumericArray(ability.cost.value?.values, after))) {
      return true;
    }
  }
  const blob = [
    ...snapshot.abilities.map((ability) => ability.rawNumericSummary),
    snapshot.level1Stats.health,
    snapshot.level1Stats.armor,
    snapshot.level1Stats.attackDamage,
    snapshot.level1Stats.healthRegen5s,
  ].join(' ');
  if (typeof after === 'number') {
    return blob.includes(String(after));
  }
  if (Array.isArray(after) && after.every((item) => typeof item === 'number')) {
    const compact = after.join(',');
    const spaced = after.join(', ');
    const slash = after.join('/');
    return blob.includes(compact) || blob.includes(spaced) || blob.includes(slash);
  }
  if (typeof after === 'string') {
    const numbers = after.match(/\d+(?:\.\d+)?/g) ?? [];
    return numbers.slice(0, 4).every((num) => blob.includes(num));
  }
  return false;
}

async function main(): Promise<void> {
  const patch = getFlag('patch') ?? '7.2c';
  const issues: Issue[] = [];
  const dir = normalizedDir(patch);
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  const snapshots: ChampionGameplaySnapshot[] = [];

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    const parsed = championGameplaySnapshotSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push({
        level: 'error',
        champion: file.replace(/\.json$/, ''),
        message: parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; '),
      });
      continue;
    }
    snapshots.push(parsed.data);
  }

  const ids = snapshots.map((snapshot) => snapshot.id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ level: 'error', message: 'Duplicate champion ids' });
  }
  if (snapshots.length !== EXPECTED_COUNT) {
    issues.push({
      level: 'error',
      message: `Expected ${EXPECTED_COUNT} champions, found ${snapshots.length}`,
    });
  }

  const gaps: Record<string, string[]> = {};
  for (const snapshot of snapshots) {
    const seen = new Set<string>();
    for (const ability of snapshot.abilities) {
      const key = `${ability.slot}::${ability.form ?? ''}`;
      if (seen.has(key)) {
        issues.push({
          level: 'error',
          champion: snapshot.id,
          message: `Duplicate ability slot ${key}`,
        });
      }
      seen.add(key);
      const cd = ability.cooldown.value;
      if (cd?.some((value) => value === null)) {
        issues.push({
          level: 'warning',
          champion: snapshot.id,
          message: `${ability.name} cooldown contains a null rank (source gap, not filled)`,
        });
      }
      if (ability.cost.value?.values.some((value) => value === null)) {
        issues.push({
          level: 'warning',
          champion: snapshot.id,
          message: `${ability.name} cost contains a null rank (source gap, not filled)`,
        });
        gaps[snapshot.name] = [
          ...(gaps[snapshot.name] ?? []),
          `${ability.name} cost has a null rank`,
        ];
      }
    }
    if (snapshot.id === 'chogath') {
      const feast = snapshot.abilities.find((ability) => ability.name === 'Feast');
      if (feast?.rawNumericSummary.includes('+8% bonus HP')) {
        issues.push({
          level: 'warning',
          champion: snapshot.id,
          message:
            "Feast numeric_summary still lists +8% bonus HP on champions; official 7.2c delta is 10%. Not auto-corrected.",
        });
        gaps[snapshot.name] = [
          ...(gaps[snapshot.name] ?? []),
          'Feast champion bonus-health ratio still +8% in numeric_summary; Riot 7.2c says 10%',
        ];
      }
    }
    if (snapshot.gaps.length > 0 || snapshot.dataStatus === 'partial') {
      gaps[snapshot.name] = [...new Set([...(gaps[snapshot.name] ?? []), ...snapshot.gaps])];
    }
    if (championIdFromName(snapshot.name) !== snapshot.id && snapshot.id !== championIdFromName(snapshot.name)) {
      // only warn when the helper would not round-trip; some ids are intentional (chogath)
      const helper = championIdFromName(snapshot.name);
      if (helper !== snapshot.id && helper.replace(/-/g, '') !== snapshot.id.replace(/-/g, '')) {
        issues.push({
          level: 'warning',
          champion: snapshot.id,
          message: `id ${snapshot.id} does not match name slug ${helper}`,
        });
      }
    }
  }

  const patchRaw = JSON.parse(await readFile(patchRecordPath(patch), 'utf8'));
  const patchParsed = normalizedPatchRecordSchema.safeParse(patchRaw);
  if (!patchParsed.success) {
    issues.push({ level: 'error', message: `Invalid patch record: ${patchParsed.error.message}` });
  } else {
    const record = patchParsed.data as NormalizedPatchRecord;
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const byName = new Map(snapshots.map((snapshot) => [snapshot.name.toLowerCase(), snapshot]));
    for (const change of record.changes) {
      const snapshot =
        byId.get(change.championId) ??
        byName.get(change.champion.toLowerCase()) ??
        [...byId.values()].find((item) => item.id.replace(/-/g, '') === change.championId.replace(/-/g, ''));
      if (!snapshot) {
        issues.push({
          level: 'warning',
          message: `Patch delta for ${change.champion} (${change.championId}) has no matching champion file`,
        });
        continue;
      }
      if (change.ability) {
        const want = normalizeAbilityName(change.ability);
        const hit = snapshot.abilities.some(
          (ability) =>
            normalizeAbilityName(ability.name) === want || normalizeAbilityName(ability.name).includes(want),
        );
        if (!hit) {
          issues.push({
            level: 'warning',
            champion: snapshot.id,
            message: `Patch section "${change.ability}" did not match an ability name`,
          });
        }
      }
      if (!afterLooksApplied(snapshot, change.after)) {
        issues.push({
          level: 'warning',
          champion: snapshot.id,
          message: `Official ${patch} ${change.ability ?? 'Base Stats'}.${change.field} after-value is not visible in the snapshot (possible stale numeric_summary)`,
        });
        const extra = `Official ${patch} ${change.field} after-value not reflected in snapshot text`;
        gaps[snapshot.name] = [...(gaps[snapshot.name] ?? []), extra];
      }
    }
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const report = {
    patch,
    championCount: snapshots.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues,
  };
  await mkdir(reportsDir(), { recursive: true });
  await writeFile(
    path.join(reportsDir(), 'champion-data-validation.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  const md = [
    `# Champion data validation (${patch})`,
    '',
    `- Champions: ${snapshots.length}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Errors',
    '',
    ...(errors.length === 0 ? ['- none'] : errors.map((issue) => `- ${issue.champion ?? 'dataset'}: ${issue.message}`)),
    '',
    '## Warnings',
    '',
    ...(warnings.length === 0
      ? ['- none']
      : warnings.map((issue) => `- ${issue.champion ?? 'dataset'}: ${issue.message}`)),
    '',
  ].join('\n');
  await writeFile(path.join(reportsDir(), 'champion-data-validation.md'), md, 'utf8');
  await writeFile(path.join(reportsDir(), 'champion-data-gaps.json'), `${JSON.stringify(gaps, null, 2)}\n`, 'utf8');
  console.log(`Validated ${snapshots.length} champions: ${errors.length} errors, ${warnings.length} warnings`);
  console.log(`Wrote ${path.join(reportsDir(), 'champion-data-validation.md')}`);
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
