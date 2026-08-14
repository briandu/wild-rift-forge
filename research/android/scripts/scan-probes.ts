import { mkdir, writeFile } from 'node:fs/promises';
import { isMainModule } from './lib/is-main';
import { REPORTS_DIR, reportPath } from './lib/paths';
import { resolveApkPath, resolveTargetFlag } from './lib/resolve-apk';
import { redactSecrets } from './lib/redact';
import { scanApkEntries } from './lib/scan-apk';

const MAX_HITS = 60;
const MAX_VALUE_LEN = 240;

const NAME_PROBES = [
  'garen',
  'darius',
  'ahri',
  "cho'gath",
  'chogath',
  'cho gath',
  'vorpal spikes',
  'vorpal',
  'feast',
  'decisive strike',
  'courage',
  'judgment',
  'judgement',
  'demacian justice',
] as const;

const NUMBER_PROBES = [
  { id: 'vorpal_old', label: 'Vorpal Spikes old 15/35/55/75', patterns: ['15/35/55/75', '15 / 35 / 55 / 75', '15, 35, 55, 75', '15,35,55,75'] },
  { id: 'vorpal_new', label: 'Vorpal Spikes new 20/45/70/95', patterns: ['20/45/70/95', '20 / 45 / 70 / 95', '20, 45, 70, 95', '20,45,70,95'] },
] as const;

export interface ProbeHit {
  file: string;
  value: string;
  encoding: string;
}

export interface ProbeReport {
  apk: string;
  target: string;
  names: Record<string, ProbeHit[]>;
  numbers: Record<string, { label: string; hits: ProbeHit[] }>;
  outcome: 'A' | 'B' | 'C';
  outcomeNote: string;
}

function clip(value: string): string {
  const trimmed = redactSecrets(value.replace(/\s+/g, ' ').trim());
  return trimmed.length > MAX_VALUE_LEN ? `${trimmed.slice(0, MAX_VALUE_LEN)}…` : trimmed;
}

function pushHit(bucket: ProbeHit[], file: string, value: string, encoding: string): void {
  const clipped = clip(value);
  if (bucket.length >= MAX_HITS || bucket.some((hit) => hit.file === file && hit.value === clipped)) {
    return;
  }
  bucket.push({ file, value: clipped, encoding });
}

function classifyOutcome(numbers: ProbeReport['numbers']): { outcome: 'A' | 'B' | 'C'; outcomeNote: string } {
  const oldHits = numbers.vorpal_old?.hits.length ?? 0;
  const newHits = numbers.vorpal_new?.hits.length ?? 0;
  if (oldHits > 0 && newHits === 0) {
    return {
      outcome: 'A',
      outcomeNote: 'Packaged resources contain the pre-7.2c Vorpal Spikes values. Current balance is likely overridden elsewhere.',
    };
  }
  if (newHits > 0) {
    return {
      outcome: 'B',
      outcomeNote: 'Packaged resources contain the current Vorpal Spikes values. Locate the containing file for a parser.',
    };
  }
  return {
    outcome: 'C',
    outcomeNote: 'Neither Vorpal Spikes number sequence was found as readable text. Numbers may be binary, server-controlled, or not in this package.',
  };
}

export function createProbeCollector(apk: string, target: string): {
  consider: (file: string, value: string, encoding: string) => void;
  result: () => ProbeReport;
} {
  const names = Object.fromEntries(NAME_PROBES.map((name) => [name, [] as ProbeHit[]]));
  const numbers = Object.fromEntries(
    NUMBER_PROBES.map((probe) => [probe.id, { label: probe.label, hits: [] as ProbeHit[] }]),
  ) as ProbeReport['numbers'];

  return {
    consider: (file, value, encoding) => {
      const lower = value.toLowerCase();
      for (const name of NAME_PROBES) {
        if (lower.includes(name)) {
          pushHit(names[name]!, file, value, encoding);
        }
      }
      for (const probe of NUMBER_PROBES) {
        if (probe.patterns.some((pattern) => value.includes(pattern))) {
          pushHit(numbers[probe.id]!.hits, file, value, encoding);
        }
      }
    },
    result: () => {
      const classified = classifyOutcome(numbers);
      return { apk, target, names, numbers, ...classified };
    },
  };
}

export async function scanApkProbes(apk: string, target: string): Promise<ProbeReport> {
  const collector = createProbeCollector(apk, target);
  await scanApkEntries(apk, `${target} probes`, collector.consider);
  return collector.result();
}

export function mergeProbeReports(results: ProbeReport[]): ProbeReport {
  const names = Object.fromEntries(NAME_PROBES.map((name) => [name, [] as ProbeHit[]]));
  const numbers = Object.fromEntries(
    NUMBER_PROBES.map((probe) => [probe.id, { label: probe.label, hits: [] as ProbeHit[] }]),
  ) as ProbeReport['numbers'];
  for (const result of results) {
    for (const name of NAME_PROBES) {
      for (const hit of result.names[name] ?? []) {
        pushHit(names[name]!, `${result.target}:${hit.file}`, hit.value, hit.encoding);
      }
    }
    for (const probe of NUMBER_PROBES) {
      for (const hit of result.numbers[probe.id]?.hits ?? []) {
        pushHit(numbers[probe.id]!.hits, `${result.target}:${hit.file}`, hit.value, hit.encoding);
      }
    }
  }
  const classified = classifyOutcome(numbers);
  return {
    apk: results.map((result) => result.apk).join(', '),
    target: 'merged',
    names,
    numbers,
    ...classified,
  };
}

export async function writeProbeReport(report: ProbeReport): Promise<void> {
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath('champion-hits.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const target = resolveTargetFlag('pad1');
  const { apk } = await resolveApkPath(target);
  console.log(`Probing champion/ability strings in ${target}: ${apk}`);
  const report = await scanApkProbes(apk, target);
  await writeProbeReport(report);
  const nameHits = Object.values(report.names).reduce((sum, bucket) => sum + bucket.length, 0);
  console.log(`${nameHits} name hits; Cho'Gath number test outcome ${report.outcome}`);
  console.log(report.outcomeNote);
  console.log(`Wrote ${reportPath('champion-hits.json')}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
