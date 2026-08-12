#!/usr/bin/env node
/**
 * Unpack a Claude Design export (.zip) into design/handoffs/<slug>/.
 *
 * Usage:
 *   node scripts/ingest-claude-design.mjs <zip-path> [--slug name] [--force]
 *   node scripts/ingest-claude-design.mjs --latest [--slug name] [--force]
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
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

function usage(code = 1) {
  console.error(`Usage:
  node scripts/ingest-claude-design.mjs <zip-path> [--slug name] [--force]
  node scripts/ingest-claude-design.mjs --latest [--slug name] [--force]`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { zip: null, slug: null, force: false, latest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--force') out.force = true;
    else if (a === '--latest') out.latest = true;
    else if (a === '--slug') out.slug = argv[++i];
    else if (a.startsWith('--slug=')) out.slug = a.slice('--slug='.length);
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      usage(1);
    } else out.zip = a;
  }
  return out;
}

function slugify(name) {
  return name
    .replace(/\.zip$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
    .filter((z) => /claude|design|rift|champion|handoff|art/i.test(z.name))
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.latest && !args.zip) usage(1);

  const zipPath = path.resolve(args.latest ? findLatestZip() : args.zip);
  if (!existsSync(zipPath)) {
    console.error(`Zip not found: ${zipPath}`);
    process.exit(1);
  }

  const slug =
    args.slug || `${new Date().toISOString().slice(0, 10)}-${slugify(path.basename(zipPath))}`;
  const dest = path.join(HANDOFFS, slug);

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

  const files = listFiles(dest);
  const html = files.filter((f) => f.endsWith('.html') || f.endsWith('.dc.html'));
  const manifest = {
    slug,
    ingested_at: new Date().toISOString(),
    source_zip: zipPath,
    source_zip_basename: path.basename(zipPath),
    visual_direction: 'premium-gaming',
    implement_into: 'apps/web',
    stack_brief: 'design/STACK.md',
    entry_html: html,
    files,
    notes:
      'Preview-only Claude Design export. Translate into Next.js — do not ship support.js to production.',
  };
  writeFileSync(path.join(dest, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(HANDOFFS, 'LATEST'), `${slug}\n`);

  console.log(`Ingested → design/handoffs/${slug}`);
  console.log(`Entries: ${html.length ? html.join(', ') : '(no html)'}`);
  console.log('Next: /import-claude-design in Cursor');
}

main();
