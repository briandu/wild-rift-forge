import { readFile, writeFile } from 'node:fs/promises';
import { isMainModule } from './lib/is-main';
import { reportPath } from './lib/paths';
import type { InventoryReport } from './inventory-apk';
import type { ProbeReport } from './scan-probes';
import type { StringHit } from './scan-strings';

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(reportPath(name), 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readText(name: string): Promise<string | null> {
  try {
    return await readFile(reportPath(name), 'utf8');
  } catch {
    return null;
  }
}

function countHits(hits: Record<string, unknown[]> | null): number {
  if (!hits) {
    return 0;
  }
  return Object.values(hits).reduce((sum, bucket) => sum + bucket.length, 0);
}

function sampleUrls(urls: StringHit[] | null, needle: RegExp, limit = 8): string[] {
  if (!urls) {
    return [];
  }
  return urls
    .map((hit) => hit.value)
    .filter((url) => needle.test(url))
    .slice(0, limit);
}

function interestingSummary(report: InventoryReport | null): string {
  if (!report) {
    return 'Not generated.';
  }
  const top = report.interesting.slice(0, 15).map((file) => `- \`${file.path}\` (${file.uncompressedSize} bytes)`);
  if (top.length === 0) {
    return 'No `.json` / `.xml` / `.bundle` / `.manifest` / similar files in the archive listing.';
  }
  return top.join('\n');
}

function nameHitSummary(report: ProbeReport | null): string {
  if (!report) {
    return 'Not generated.';
  }
  const lines = Object.entries(report.names).map(([name, hits]) => `- \`${name}\`: ${hits.length} hit(s)`);
  return `${lines.join('\n')}\n\nNumber-test outcome **${report.outcome}**: ${report.outcomeNote}`;
}

function nextBranch(probes: ProbeReport | null, urls: StringHit[] | null): string {
  const hasNumbers = probes && (probes.outcome === 'A' || probes.outcome === 'B');
  const hasCdn = (urls ?? []).some((hit) => /riot|cdn|manifest|patch/i.test(hit.value));
  if (hasNumbers) {
    return 'Gameplay numbers appear in-package. Next: identify the containing file format and write a research parser. Do not wire production ingest yet.';
  }
  if (hasCdn) {
    return 'No (or incomplete) in-package numbers, but CDN/manifest/patch URLs are exposed. Next: document those endpoints and fetch only small public manifests — preferred long-term source.';
  }
  return 'Neither readable gameplay numbers nor obvious public resource URLs were found. Next: inspect normal post-install / runtime resources. An emulator collector is last resort.';
}

export async function writeFindings(): Promise<void> {
  const acquisition = await readJson<Record<string, unknown>>('acquisition.json');
  const baseInv = await readJson<InventoryReport>('base-file-list.json');
  const padInv = await readJson<InventoryReport>('pad1-file-list.json');
  const hits = await readJson<Record<string, StringHit[]>>('string-hits.json');
  const urls = await readJson<StringHit[]>('urls.json');
  const probes = await readJson<ProbeReport>('champion-hits.json');
  const manifest = await readText('android-manifest.md');

  const riotUrls = sampleUrls(urls, /riot|wildrift|leagueoflegends/i);
  const manifestUrls = sampleUrls(urls, /manifest|patch|resource|bundle|cdn/i);
  const packageLine = manifest?.match(/- Package: `([^`]+)`/)?.[1] ?? 'unknown';

  const md = `# Android investigation findings

Generated from \`research/android/reports/\`. Research only — not a production data source.

## Package

- Store version: \`${String(acquisition?.version ?? baseInv?.version ?? 'unknown')}\`
- Acquisition: \`${String(acquisition?.source ?? 'unknown')}\`
- Source URL: \`${String(acquisition?.sourceUrl ?? 'unknown')}\`
- Package: \`${packageLine}\`
- base.apk files: ${baseInv?.fileCount ?? 'n/a'} (${baseInv ? `${baseInv.uncompressedBytes} bytes uncompressed` : 'not inventoried'})
- split_pad1.apk files: ${padInv?.fileCount ?? 'n/a'} (${padInv ? `${padInv.uncompressedBytes} bytes uncompressed` : 'not inventoried'})
- Keyword hits: ${countHits(hits)}
- Unique URLs: ${urls?.length ?? 0}

## 1. Does base.apk contain champion data?

${interestingSummary(baseInv)}

Name probes are reported in section 2 / \`champion-hits.json\`. Text-like champion files in base would show up under interesting extensions above.

## 2. Does split_pad1.apk contain champion data?

${nameHitSummary(probes)}

Interesting pad1 files:

${interestingSummary(padInv)}

## 3. Are detailed ability numbers present?

${probes ? `Cho'Gath Vorpal Spikes test outcome **${probes.outcome}**. ${probes.outcomeNote}` : 'Probe report not generated.'}

## 4. Where are champion icons stored?

From inventories, look for png / webp / ktx / Unity / AssetBundle paths. Largest pad1 directories:

${
  padInv?.largestDirectories
    .slice(0, 10)
    .map((dir) => `- \`${dir.path}\` (${dir.files} files, ${dir.uncompressedBytes} bytes)`)
    .join('\n') ?? '- pad1 inventory not generated'
}

## 5. Where are ability icons stored?

Same as section 4 until a named ability icon path appears in \`string-hits.json\` or \`champion-hits.json\`. No exporter was written in this pass.

## 6. Are Riot CDN endpoints exposed?

${riotUrls.length > 0 ? riotUrls.map((url) => `- \`${url}\``).join('\n') : '- No URL containing riot / wildrift / leagueoflegends was extracted.'}

## 7. Are resource manifests exposed?

${manifestUrls.length > 0 ? manifestUrls.map((url) => `- \`${url}\``).join('\n') : '- No URL containing manifest / patch / resource / bundle / cdn was extracted.'}

Keyword buckets \`manifest\`, \`patch\`, \`resource\`, and \`cdn\` are in \`string-hits.json\`.

## 8. Does the client reference downloadable resource packages?

See \`android-manifest.md\` (asset-pack / download / update services) and string hits for \`pad1\`, \`download\`, \`update\`, and \`asset\`.

## 9. Is there evidence gameplay balance data is delivered separately?

The Play Store build stayed at \`7.2.0.2460\` while balance patches \`7.2a/b/c\` shipped. Combined with the Cho'Gath number test:

${probes ? `- Outcome ${probes.outcome}: ${probes.outcomeNote}` : '- Number test not run.'}

## 10. Can this data realistically be acquired automatically?

- APKMirror listing check (\`--check\`) is small and cron-safe.
- Full bundle download is hundreds of megabytes and may be blocked by Cloudflare. \`--from-file\` remains the reliable path.
- Automatic ingest into Forge is **not** justified until a stable public manifest/CDN or a clearly parsed in-package format exists.

## 11. What should we investigate next?

${nextBranch(probes, urls)}

## Classification

| Category | Evidence in this pass |
| --- | --- |
| A Static assets | Inventory directories and image/bundle extensions |
| B Static metadata | Manifest package/version; any champion name hits |
| C Gameplay data | Cho'Gath number-test outcome |
| D Resource infrastructure | URLs and manifest/CDN/patch string hits |

## Reports

- \`acquisition.json\`
- \`apkm-info.json\`
- \`base-file-list.txt\` / \`base-file-list.json\`
- \`pad1-file-list.txt\` / \`pad1-file-list.json\`
- \`android-manifest.md\`
- \`string-hits.json\`
- \`urls.json\`
- \`champion-hits.json\`
`;

  await writeFile(reportPath('FINDINGS.generated.md'), md, 'utf8');
}

if (isMainModule(import.meta.url)) {
  writeFindings().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
