#!/usr/bin/env node
/**
 * Unpack a Claude Design export (.zip) into design/handoffs/vNN-slug/.
 *
 * Claude's download names reset (`Champion-art plan update (3).zip`) and collide.
 * Identity is the sequential version, not the zip filename.
 *
 * Usage:
 *   node scripts/ingest-claude-design.mjs <zip-path> [--title "..."] [--offers "..."] [--slug name] [--force]
 *   node scripts/ingest-claude-design.mjs --latest [--title "..."] [--offers "..."]
 *   node scripts/ingest-claude-design.mjs --migrate-versions
 *   node scripts/ingest-claude-design.mjs --rebuild-catalog
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HANDOFFS = path.join(ROOT, 'design', 'handoffs');
const INDEX_PATH = path.join(HANDOFFS, 'INDEX.json');
const CHANGELOG_PATH = path.join(HANDOFFS, 'CHANGELOG.md');
const LATEST_PATH = path.join(HANDOFFS, 'LATEST');

/** One-time map of date-prefixed folders → versioned slugs + patch notes. */
const LEGACY_PATCHES = [
  {
    old: '2026-08-11-champion-art-plan',
    version: 1,
    slug: 'v01-premium-gaming-baseline',
    title: 'Premium Gaming baseline',
    offers: [
      'Locks visual direction 1B (Premium Gaming): dark #0B0A12, cyan #16C0FF / #7FDCFF, Archivo, art-led heroes.',
      'Canvases: Riftline Premium Gaming (homepage + counters), Next Screens (profile, draft, empty/loading/sparse), WildRift Directions (1A / 1B / 1C).',
      'Do not reopen 1A (dense analytics) or 1C (command palette) unless asked.',
    ],
  },
  {
    old: '2026-08-12-champion-art-plan-update-2',
    version: 2,
    slug: 'v02-product-canvases',
    title: 'Product canvases + mobile',
    offers: [
      'First Wild Rift Forge product canvases (desktop + mobile) instead of direction studies only.',
      'Adds logo, Gwen ability icons, and the iOS frame helper.',
    ],
  },
  {
    old: '2026-08-12-champion-art-plan-update-3',
    version: 3,
    slug: 'v03-champion-list-directions',
    title: 'Champion list directions',
    offers: [
      'Adds Champion List Directions — roster / directory explorations for the champions index.',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update-5',
    version: 4,
    slug: 'v04-champion-list-refine',
    title: 'Champion list refinements',
    offers: [
      'Refines the champion-list explorations (same canvas set as v03, extra pasted refs).',
      'Claude skipped an “update (4)” download; this is the next ingest after v03.',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update-6',
    version: 5,
    slug: 'v05-matchup-page-directions',
    title: 'Matchup page directions',
    offers: [
      'Adds Matchup Page Directions — versus-poster / rail explorations for /matchups.',
      'Adds the wordmark-without-text logo.',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update-7',
    version: 6,
    slug: 'v06-matchup-page-refine',
    title: 'Matchup page refinements',
    offers: [
      'Refines matchup-page directions (extra pasted refs).',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update-8',
    version: 7,
    slug: 'v07-matchup-page-polish',
    title: 'Matchup page polish',
    offers: [
      'Further matchup / list polish on the same canvas set as v06.',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update-9',
    version: 8,
    slug: 'v08-auth-emails',
    title: 'Auth emails',
    offers: [
      'Adds branded email HTML: Welcome, Password Reset, Weekly Digest.',
    ],
  },
  {
    old: '2026-08-13-champion-art-plan-update',
    version: 9,
    slug: 'v09-mobile-draft-nav',
    title: 'Mobile draft + five-tab nav',
    offers: [
      'Adds Draft Layout Ideas — sheet-layout studies for the mobile draft board.',
      'Five-tab mobile bottom nav and a large mobile draft-pick layout update.',
    ],
  },
  {
    old: '2026-08-14-champion-art-plan-update-1',
    version: 10,
    slug: 'v10-product-polish',
    title: 'Product polish',
    offers: [
      'Incremental desktop + mobile polish on the existing product canvases.',
    ],
  },
  {
    old: '2026-08-14-champion-art-plan-update-2',
    version: 11,
    slug: 'v11-lane-glyphs',
    title: 'Lane glyphs + ability tips',
    offers: [
      'Adds Lane Glyphs canvas and traced glyph sources (baron / mid / jungle / duo / support).',
      'Ability-tip treatment on kits and matchup copy.',
    ],
  },
];

function usage(code = 1) {
  console.error(`Usage:
  node scripts/ingest-claude-design.mjs <zip-path> [--title "..."] [--offers "a; b"] [--slug name] [--force]
  node scripts/ingest-claude-design.mjs --latest [--title "..."] [--offers "..."]
  node scripts/ingest-claude-design.mjs --migrate-versions
  node scripts/ingest-claude-design.mjs --rebuild-catalog`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    zip: null,
    slug: null,
    title: null,
    offers: [],
    force: false,
    latest: false,
    migrate: false,
    rebuild: false,
    renameSource: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--force') out.force = true;
    else if (a === '--latest') out.latest = true;
    else if (a === '--migrate-versions') out.migrate = true;
    else if (a === '--rebuild-catalog') out.rebuild = true;
    else if (a === '--no-rename-source') out.renameSource = false;
    else if (a === '--slug') out.slug = argv[++i];
    else if (a.startsWith('--slug=')) out.slug = a.slice('--slug='.length);
    else if (a === '--title') out.title = argv[++i];
    else if (a.startsWith('--title=')) out.title = a.slice('--title='.length);
    else if (a === '--offers') out.offers.push(...splitOffers(argv[++i]));
    else if (a.startsWith('--offers=')) out.offers.push(...splitOffers(a.slice('--offers='.length)));
    else if (a === '--offer') out.offers.push(String(argv[++i] ?? '').trim());
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      usage(1);
    } else out.zip = a;
  }
  return out;
}

function splitOffers(raw) {
  return String(raw ?? '')
    .split(/\s*;\s*|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(name) {
  return name
    .replace(/\.zip$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function padVersion(n) {
  return `v${String(n).padStart(2, '0')}`;
}

function versionedZipName(slug) {
  return `wrf-design-${slug}.zip`;
}

function listVersionDirs() {
  if (!existsSync(HANDOFFS)) return [];
  return readdirSync(HANDOFFS)
    .filter((name) => /^v\d+-/.test(name) && statSync(path.join(HANDOFFS, name)).isDirectory())
    .sort();
}

function nextVersionNumber() {
  let max = 0;
  for (const name of listVersionDirs()) {
    const m = name.match(/^v(\d+)-/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function downloadsDir() {
  if (process.platform === 'win32') {
    return path.join(homedir(), 'Downloads');
  }
  const user = process.env.USER || process.env.USERNAME || '';
  const wsl = `/mnt/c/Users/${user}/Downloads`;
  if (user && existsSync(wsl)) return wsl;
  return path.join(homedir(), 'Downloads');
}

function findLatestZip() {
  const dir = downloadsDir();
  if (!existsSync(dir)) {
    throw new Error(`Downloads folder not found: ${dir}`);
  }
  const zips = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((f) => {
      const full = path.join(dir, f);
      return { full, mtime: statSync(full).mtimeMs, name: f };
    })
    .filter((z) => /claude|design|rift|champion|handoff|art|wrf-design/i.test(z.name))
    .sort((a, b) => b.mtime - a.mtime);
  if (!zips.length) {
    throw new Error(
      `No matching .zip in ${dir}. Pass an explicit path, or name exports with design/claude/rift.`,
    );
  }
  return zips[0].full;
}

function unzip(zipPath, dest) {
  mkdirSync(dest, { recursive: true });
  const tar = spawnSync('tar', ['-xf', zipPath, '-C', dest], { encoding: 'utf8' });
  if (tar.status === 0) return;
  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: 'utf8' },
  );
  if (ps.status !== 0) {
    throw new Error(
      `Failed to unzip.\ntar: ${tar.stderr || tar.stdout}\nps: ${ps.stderr || ps.stdout}`,
    );
  }
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'source.zip' || name === 'PATCH.md' || name === 'MANIFEST.json') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out.sort();
}

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else {
      mkdirSync(path.dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }
  }
}

function flattenSingleRoot(dest) {
  const top = readdirSync(dest);
  if (top.length !== 1) return;
  const only = path.join(dest, top[0]);
  if (!statSync(only).isDirectory()) return;
  for (const name of readdirSync(only)) {
    const from = path.join(only, name);
    const to = path.join(dest, name);
    if (existsSync(to)) rmSync(to, { recursive: true, force: true });
    try {
      renameSync(from, to);
    } catch {
      if (statSync(from).isDirectory()) copyTree(from, to);
      else copyFileSync(from, to);
      rmSync(from, { recursive: true, force: true });
    }
  }
  rmSync(only, { recursive: true, force: true });
}

function gitMv(from, to) {
  const mv = spawnSync('git', ['mv', from, to], { cwd: ROOT, encoding: 'utf8' });
  if (mv.status === 0) return;
  renameSync(from, to);
}

function archiveZip(zipPath, destDir, slug, renameSource) {
  const destZip = path.join(destDir, 'source.zip');
  copyFileSync(zipPath, destZip);

  if (!renameSource) return path.basename(zipPath);

  const versioned = versionedZipName(slug);
  const parent = path.dirname(zipPath);
  const target = path.join(parent, versioned);
  if (path.resolve(zipPath) === path.resolve(target)) return versioned;
  if (existsSync(target)) {
    console.warn(`Versioned zip already exists, left source in place: ${target}`);
    return path.basename(zipPath);
  }
  try {
    renameSync(zipPath, target);
    return versioned;
  } catch (err) {
    console.warn(`Could not rename source zip (${err.message}). Copied source.zip only.`);
    return path.basename(zipPath);
  }
}

function writePatchMd(dest, meta) {
  const canvases = (meta.entry_html ?? []).map((f) => `- \`${f}\``).join('\n');
  const offers = (meta.offers ?? []).map((o) => `- ${o}`).join('\n');
  const body = `# ${meta.version_label} — ${meta.title}

- **Ingested:** ${meta.ingested_at}
- **Legacy folder:** ${meta.legacy_slug ?? '—'}
- **Claude download name:** ${meta.source_zip_basename}
- **Archived zip:** \`source.zip\` (gitignored) / \`${versionedZipName(meta.slug)}\`

## Offers

${offers || '- _(fill this in — what did this export add or change?)_'}

## Canvases

${canvases || '- _(none)_'}

## Implement

Translate new / changed product canvases into \`apps/web\`. Diff against the previous version. Do not ship \`support.js\`. Do not treat mock WR / pick rates as facts.
`;
  writeFileSync(path.join(dest, 'PATCH.md'), body);
}

function readPatchRecord(dirName) {
  const dir = path.join(HANDOFFS, dirName);
  const manifestPath = path.join(dir, 'MANIFEST.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return {
    version: manifest.version,
    version_label: manifest.version_label ?? padVersion(manifest.version),
    slug: manifest.slug ?? dirName,
    title: manifest.title ?? dirName,
    ingested_at: manifest.ingested_at,
    offers: manifest.offers ?? [],
    entry_html: manifest.entry_html ?? [],
    legacy_slug: manifest.legacy_slug ?? null,
    source_zip_basename: manifest.source_zip_basename ?? null,
    source_zip_versioned: manifest.source_zip_versioned ?? versionedZipName(manifest.slug ?? dirName),
  };
}

function writeCatalog() {
  const records = listVersionDirs()
    .map(readPatchRecord)
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);

  const index = {
    scheme: 'vNN-short-slug',
    zip_scheme: 'wrf-design-vNN-short-slug.zip',
    note: 'Claude download names reset and collide. Use version + slug as identity.',
    latest: existsSync(LATEST_PATH) ? readFileSync(LATEST_PATH, 'utf8').trim() : null,
    patches: records,
  };
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);

  const rows = records
    .map((p) => `| ${p.version_label} | \`${p.slug}\` | ${p.title} | ${(p.offers[0] ?? '').replace(/\|/g, '/')} |`)
    .join('\n');

  const details = records
    .map((p) => {
      const offers = (p.offers ?? []).map((o) => `- ${o}`).join('\n');
      const canvases = (p.entry_html ?? []).map((f) => `\`${f}\``).join(', ');
      return `## ${p.version_label} — ${p.title}

- Folder: \`design/handoffs/${p.slug}/\`
- Ingested: ${p.ingested_at ?? 'unknown'}
- Claude download name: ${p.source_zip_basename ?? '—'}
- Canvases: ${canvases || '—'}

${offers}
`;
    })
    .join('\n');

  const md = `# Design handoff changelog

Claude Design exports are stored under \`design/handoffs/vNN-short-slug/\`.

**Do not use Claude’s download name as identity.** Names like \`Champion-art plan update (3).zip\` reset between sessions and collide with older exports. Sequential \`vNN\` is the source of truth. See \`INDEX.json\` for the machine-readable catalog.

| Version | Folder | Title | What it offers |
| --- | --- | --- | --- |
${rows}

${details}
`;
  writeFileSync(CHANGELOG_PATH, md);
  console.log(`Catalog → design/handoffs/CHANGELOG.md (${records.length} patches)`);
}

function applyVersionMeta(dest, {
  slug,
  version,
  title,
  offers,
  ingestedAt,
  zipPath,
  sourceZipBasename,
  sourceZipVersioned,
  legacySlug,
  files,
  html,
}) {
  const manifest = {
    slug,
    version,
    version_label: padVersion(version),
    title,
    offers,
    ingested_at: ingestedAt,
    legacy_slug: legacySlug ?? null,
    source_zip: zipPath,
    source_zip_basename: sourceZipBasename,
    source_zip_versioned: sourceZipVersioned,
    visual_direction: 'premium-gaming',
    implement_into: 'apps/web',
    stack_brief: 'design/STACK.md',
    changelog: 'design/handoffs/CHANGELOG.md',
    entry_html: html,
    files,
    notes:
      'Preview-only Claude Design export. Translate into Next.js — do not ship support.js to production.',
  };
  writeFileSync(path.join(dest, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writePatchMd(dest, manifest);
}

function migrateVersions() {
  mkdirSync(HANDOFFS, { recursive: true });
  for (const patch of LEGACY_PATCHES) {
    const from = path.join(HANDOFFS, patch.old);
    const to = path.join(HANDOFFS, patch.slug);
    if (!existsSync(from)) {
      if (existsSync(to)) {
        console.log(`Already versioned: ${patch.slug}`);
        continue;
      }
      console.warn(`Missing legacy folder: ${patch.old}`);
      continue;
    }
    if (existsSync(to)) {
      console.warn(`Target exists, skipped: ${patch.slug}`);
      continue;
    }
    gitMv(from, to);
    console.log(`${patch.old} → ${patch.slug}`);
  }

  for (const patch of LEGACY_PATCHES) {
    const dest = path.join(HANDOFFS, patch.slug);
    if (!existsSync(dest)) continue;
    const prevPath = path.join(dest, 'MANIFEST.json');
    const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : {};
    const files = listFiles(dest);
    const html = files.filter((f) => f.endsWith('.html') || f.endsWith('.dc.html'));
    applyVersionMeta(dest, {
      slug: patch.slug,
      version: patch.version,
      title: patch.title,
      offers: patch.offers,
      ingestedAt: prev.ingested_at ?? new Date().toISOString(),
      zipPath: prev.source_zip ?? null,
      sourceZipBasename: prev.source_zip_basename ?? null,
      sourceZipVersioned: versionedZipName(patch.slug),
      legacySlug: patch.old,
      files,
      html,
    });
  }

  const latestLegacy = readFileSync(LATEST_PATH, 'utf8').trim();
  const mapped = LEGACY_PATCHES.find((p) => p.old === latestLegacy || p.slug === latestLegacy);
  if (mapped) writeFileSync(LATEST_PATH, `${mapped.slug}\n`);

  writeCatalog();
}

function ingest(args) {
  const zipPath = path.resolve(args.latest ? findLatestZip() : args.zip);
  if (!existsSync(zipPath)) {
    console.error(`Zip not found: ${zipPath}`);
    process.exit(1);
  }

  const version = nextVersionNumber();
  const title =
    args.title ||
    path
      .basename(zipPath)
      .replace(/\.zip$/i, '')
      .replace(/champion-art plan update\s*/i, 'Design update ')
      .trim();
  const titleSlug = args.slug
    ? slugify(args.slug).replace(/^v\d+-/, '')
    : slugify(title);
  const slug = `${padVersion(version)}-${titleSlug}`;
  const dest = path.join(HANDOFFS, slug);
  const offers = args.offers.length
    ? args.offers
    : ['_(fill PATCH.md — what did this export add or change?)_'];

  if (existsSync(dest)) {
    if (!args.force) {
      console.error(`Handoff already exists: ${dest}\nRe-run with --force to replace.`);
      process.exit(1);
    }
    rmSync(dest, { recursive: true, force: true });
  }

  mkdirSync(HANDOFFS, { recursive: true });
  unzip(zipPath, dest);
  flattenSingleRoot(dest);

  const sourceZipVersioned = archiveZip(zipPath, dest, slug, args.renameSource);
  const files = listFiles(dest);
  const html = files.filter((f) => f.endsWith('.html') || f.endsWith('.dc.html'));

  applyVersionMeta(dest, {
    slug,
    version,
    title,
    offers,
    ingestedAt: new Date().toISOString(),
    zipPath,
    sourceZipBasename: path.basename(zipPath),
    sourceZipVersioned,
    legacySlug: null,
    files,
    html,
  });
  writeFileSync(LATEST_PATH, `${slug}\n`);
  writeCatalog();

  console.log(`Ingested → design/handoffs/${slug}`);
  console.log(`Version: ${padVersion(version)} — ${title}`);
  console.log(`Entries: ${html.length ? html.join(', ') : '(no html)'}`);
  console.log('Next: /implement-design-update in Cursor');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.migrate) {
    migrateVersions();
    return;
  }
  if (args.rebuild) {
    writeCatalog();
    return;
  }
  if (!args.latest && !args.zip) usage(1);
  ingest(args);
}

main();
