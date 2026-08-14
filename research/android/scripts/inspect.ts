import { getFlag } from './lib/cli';
import { DEFAULT_VERSION, apkPath } from './lib/paths';
import { scanApkEntries } from './lib/scan-apk';
import { writeInventory } from './inventory-apk';
import { writeManifestReport } from './parse-manifest';
import { createProbeCollector, mergeProbeReports, writeProbeReport } from './scan-probes';
import { createStringCollector, mergeStringScans, writeStringReports } from './scan-strings';
import { writeFindings } from './write-findings';

async function scanBoth(apk: string, target: 'base' | 'pad1') {
  const strings = createStringCollector(apk, target);
  const probes = createProbeCollector(apk, target);
  await scanApkEntries(apk, target, (file, value, encoding) => {
    strings.consider(file, value, encoding);
    probes.consider(file, value, encoding);
  });
  return { strings: strings.result(), probes: probes.result() };
}

async function main(): Promise<void> {
  const version = getFlag('version') ?? DEFAULT_VERSION;
  const base = getFlag('apk') ?? apkPath(version, 'base');
  const pad1 = apkPath(version, 'pad1');

  console.log('== Inventory base ==');
  await writeInventory(base, 'base', version);

  console.log('== Manifest ==');
  await writeManifestReport(base, version);

  console.log('== Scan base ==');
  const baseScan = await scanBoth(base, 'base');

  let padScan: Awaited<ReturnType<typeof scanBoth>> | null = null;
  try {
    console.log('== Inventory pad1 ==');
    await writeInventory(pad1, 'pad1', version);
    console.log('== Scan pad1 (this can take a while) ==');
    padScan = await scanBoth(pad1, 'pad1');
  } catch (error) {
    console.warn(`pad1 not available: ${error instanceof Error ? error.message : error}`);
    console.warn('Continuing with base.apk only. Unpack the APKM or pass a complete --version input dir.');
  }

  const stringResults = padScan ? [baseScan.strings, padScan.strings] : [baseScan.strings];
  await writeStringReports(mergeStringScans(stringResults));
  await writeProbeReport(mergeProbeReports(padScan ? [baseScan.probes, padScan.probes] : [baseScan.probes]));
  await writeFindings();
  console.log('Wrote research/android/reports/FINDINGS.generated.md (curated notes stay in FINDINGS.md)');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
