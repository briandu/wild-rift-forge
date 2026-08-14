import { mkdir, writeFile } from 'node:fs/promises';
import { decodeAndroidManifest, type DecodedManifest } from './lib/axml';
import { redactSecrets } from './lib/redact';
import { isMainModule } from './lib/is-main';
import { REPORTS_DIR, reportPath } from './lib/paths';
import { resolveApkPath } from './lib/resolve-apk';
import { readZipEntry } from './lib/zip';

const HINT_RE =
  /pad1|asset.?pack|play asset|asset delivery|download|patch|manifest|resource|update|bundle|cdn|riot/i;

function bullet(items: string[]): string {
  if (items.length === 0) {
    return '- (none)';
  }
  return items.map((item) => `- \`${item}\``).join('\n');
}

function toMarkdown(apk: string, version: string | null, manifest: DecodedManifest): string {
  const hintElements = manifest.elements.filter((element) => {
    const blob = `${element.name} ${element.attributes.map((attr) => `${attr.name}=${attr.value}`).join(' ')}`;
    return HINT_RE.test(blob);
  });
  const lines = [
    '# AndroidManifest.xml',
    '',
    `- APK: \`${apk}\``,
    `- Store version: \`${version ?? 'unknown'}\``,
    `- Package: \`${manifest.packageName ?? 'unknown'}\``,
    `- versionName: \`${manifest.versionName ?? 'unknown'}\``,
    `- versionCode: \`${manifest.versionCode ?? 'unknown'}\``,
    '',
    '## Permissions',
    '',
    bullet(manifest.permissions),
    '',
    '## Activities',
    '',
    bullet(manifest.activities),
    '',
    '## Services',
    '',
    bullet(manifest.services),
    '',
    '## Providers',
    '',
    bullet(manifest.providers),
    '',
    '## Receivers',
    '',
    bullet(manifest.receivers),
    '',
    '## Features',
    '',
    bullet(manifest.usesFeatures),
    '',
    '## Meta-data',
    '',
    manifest.metaData.length === 0
      ? '- (none)'
      : manifest.metaData
          .map((item) => `- \`${item.name}\` = \`${redactSecrets(item.value)}\``)
          .join('\n'),
    '',
    '## Asset delivery / download / patch hints',
    '',
    hintElements.length === 0
      ? '- (none matched pad1 / asset pack / download / patch / CDN / riot)'
      : hintElements
          .map((element) => {
            const attrs = element.attributes.map((attr) => `${attr.name}="${attr.value}"`).join(' ');
            return `- \`<${element.name} ${attrs}>\``;
          })
          .join('\n'),
    '',
  ];
  return lines.join('\n');
}

export async function writeManifestReport(apk: string, version: string | null): Promise<DecodedManifest> {
  const buffer = await readZipEntry(apk, 'AndroidManifest.xml');
  const manifest = decodeAndroidManifest(buffer);
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(reportPath('android-manifest.md'), toMarkdown(apk, version, manifest), 'utf8');
  await writeFile(
    reportPath('android-manifest.json'),
    `${redactSecrets(JSON.stringify(manifest, null, 2))}\n`,
    'utf8',
  );
  return manifest;
}

async function main(): Promise<void> {
  const { apk, version } = await resolveApkPath('base');
  console.log(`Parsing AndroidManifest.xml from ${apk}`);
  const manifest = await writeManifestReport(apk, version);
  console.log(`package ${manifest.packageName} versionName ${manifest.versionName} versionCode ${manifest.versionCode}`);
  console.log(`Wrote ${reportPath('android-manifest.md')}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
