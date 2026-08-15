#!/usr/bin/env node
/**
 * Gather current Wild Rift item and rune icons from the public RiftGG directories.
 *
 *   node scripts/gather-wild-rift-items-runes.mjs
 *   node scripts/gather-wild-rift-items-runes.mjs --force --include-legacy
 *   node scripts/gather-wild-rift-items-runes.mjs --out data/raw/items-runes
 *
 * Writes manifests plus original / png-512 / png-256 trees. Filenames follow
 * the Forge convention: item-<slug>.png and rune-<slug>.png.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('\nMissing dependency: sharp');
  console.error('Run from the repo root after `npm install` (apps/scraper depends on sharp).\n');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const INCLUDE_LEGACY = args.has('--include-legacy');
const OUT_INDEX = process.argv.indexOf('--out');
const OUT =
  OUT_INDEX !== -1 && process.argv[OUT_INDEX + 1]
    ? path.resolve(process.argv[OUT_INDEX + 1])
    : path.resolve(process.cwd(), 'data/raw/items-runes');

const REQUEST_GAP_MS = 1500;

const PAGES = {
  items: 'https://www.riftgg.app/en/items',
  runes: 'https://www.riftgg.app/en/runes',
};

const LEGACY = {
  items: [
    {
      name: 'Spirit Visage',
      slug: 'spirit-visage',
      url: 'https://wildriftguides.gg/img/wildrift/items/74/spirit-visage.webp',
      note: 'Legacy item; optional extra from non-official fallback source.',
    },
  ],
  runes: [
    {
      name: 'Hunter–Titan',
      slug: 'hunter-titan',
      url: 'https://wildriftguides.gg/img/wildrift/runes/HunterTitan.png',
      note: 'Legacy rune; optional extra from non-official fallback source.',
    },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;

async function awaitRequestSlot() {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < REQUEST_GAP_MS) {
    await sleep(REQUEST_GAP_MS - sinceLast);
  }
  lastRequestAt = Date.now();
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((part) => {
      const lowers = new Set(['of', 'the', 'and', 'a', 'an', 'to']);
      if (lowers.has(part)) return part;
      if (part === 'bf') return 'B. F.';
      if (part === 'ap') return 'AP';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\bS\b/g, "'s")
    .replace(/\bIxtali Seedjar\b/, 'Ixtali Seedjar');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function rel(file) {
  return path.relative(OUT, file).split(path.sep).join('/');
}

async function fetchText(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      await awaitRequestSlot();
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 WildRiftForge/1.0 (item-rune-gatherer)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      last = e;
      if (i < retries - 1) await sleep(500 * (i + 1));
    }
  }
  throw new Error(`Fetch failed: ${url} — ${last?.message ?? last}`);
}

async function fetchBuffer(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      await awaitRequestSlot();
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 WildRiftForge/1.0 (item-rune-gatherer)',
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < retries - 1) await sleep(500 * (i + 1));
    }
  }
  throw new Error(`Fetch failed: ${url} — ${last?.message ?? last}`);
}

function decodeHtml(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('–', '–');
}

function extractAttr(tag, attr) {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = tag.match(re);
  return match ? decodeHtml(match[2]) : undefined;
}

function firstUrlFromSrcset(srcset) {
  if (!srcset) return undefined;
  return srcset.split(',')[0]?.trim().split(/\s+/)[0];
}

function dedupeByUrl(records) {
  const seen = new Set();
  const out = [];
  for (const record of records) {
    if (!record.url || seen.has(record.url)) continue;
    seen.add(record.url);
    out.push(record);
  }
  return out;
}

function sortByName(records) {
  return [...records].sort((a, b) => a.name.localeCompare(b.name));
}

function extractRecordsFromHtml(html, kind) {
  const needle = `assets.riftgg.app/${kind}/`;
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const records = [];

  for (const tag of imgTags) {
    if (!tag.includes(needle)) continue;
    const src = extractAttr(tag, 'src') || firstUrlFromSrcset(extractAttr(tag, 'srcset'));
    const alt = extractAttr(tag, 'alt') || '';
    const nameMatch = alt.match(
      new RegExp(`Image:\\s*(.*?)\\s*-\\s*Wild Rift ${kind === 'items' ? 'Item' : 'Rune'}`, 'i'),
    );
    const name = nameMatch?.[1]?.trim();
    const url = src?.startsWith('http') ? src : undefined;
    if (!url) continue;
    const base = url.split('?')[0].split('/').pop() || '';
    const slug = base.replace(/\.(png|webp|jpg|jpeg)$/i, '');
    records.push({
      kind,
      name: name || titleFromSlug(slug),
      slug,
      url,
      source: 'RiftGG',
    });
  }

  const unique = dedupeByUrl(records);
  if (unique.length) return sortByName(unique);

  const urlRe = new RegExp(
    `https://assets\\.riftgg\\.app/${kind}/[^"'\\s<>]+?\\.(?:webp|png|jpg|jpeg)`,
    'g',
  );
  const urls = [...new Set(html.match(urlRe) ?? [])];
  return sortByName(
    urls.map((url) => {
      const base = url.split('?')[0].split('/').pop() || '';
      const slug = base.replace(/\.(png|webp|jpg|jpeg)$/i, '');
      return {
        kind,
        name: titleFromSlug(slug),
        slug,
        url,
        source: 'RiftGG-fallback',
      };
    }),
  );
}

async function writeOriginal(buffer, record) {
  const ext = path.extname(new URL(record.url).pathname) || '.webp';
  const outDir = path.join(OUT, 'original', record.kind);
  await ensureDir(outDir);
  const outFile = path.join(
    outDir,
    `${record.kind === 'items' ? 'item' : 'rune'}-${record.slug}${ext}`,
  );
  if (!FORCE && (await exists(outFile))) return outFile;
  await fs.writeFile(outFile, buffer);
  return outFile;
}

async function writePng(buffer, record, size) {
  const outDir = path.join(OUT, `png-${size}`, record.kind);
  await ensureDir(outDir);
  const outFile = path.join(
    outDir,
    `${record.kind === 'items' ? 'item' : 'rune'}-${record.slug}.png`,
  );
  if (!FORCE && (await exists(outFile))) return outFile;
  await sharp(buffer)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outFile);
  return outFile;
}

async function gatherPage(kind) {
  const html = await fetchText(PAGES[kind]);
  const records = extractRecordsFromHtml(html, kind);
  if (!records.length) throw new Error(`No ${kind} records found.`);
  return records;
}

async function downloadRecord(record) {
  const buffer = await fetchBuffer(record.url);
  const original = await writeOriginal(buffer, record);
  const png512 = await writePng(buffer, record, 512);
  const png256 = await writePng(buffer, record, 256);
  return {
    ...record,
    files: {
      original: rel(original),
      png512: rel(png512),
      png256: rel(png256),
    },
  };
}

async function writeManifest(name, data) {
  const file = path.join(OUT, name);
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  await ensureDir(OUT);

  console.log(`\nWild Rift items + runes gatherer`);
  console.log(`Output: ${OUT}`);
  console.log(FORCE ? 'Mode: overwrite existing files' : 'Mode: skip existing files when present');
  if (INCLUDE_LEGACY) console.log('Legacy mode: include optional legacy extras');

  const itemRecords = await gatherPage('items');
  const runeRecords = await gatherPage('runes');

  const records = {
    items: [...itemRecords],
    runes: [...runeRecords],
  };

  if (INCLUDE_LEGACY) {
    records.items.push(
      ...LEGACY.items.map((x) => ({ ...x, kind: 'items', source: 'Legacy fallback' })),
    );
    records.runes.push(
      ...LEGACY.runes.map((x) => ({ ...x, kind: 'runes', source: 'Legacy fallback' })),
    );
    records.items = dedupeByUrl(records.items);
    records.runes = dedupeByUrl(records.runes);
  }

  console.log(`\nFound ${records.items.length} item records`);
  console.log(`Found ${records.runes.length} rune records`);

  const downloaded = { items: [], runes: [] };
  const failures = [];

  for (const kind of ['items', 'runes']) {
    console.log(`\nDownloading ${kind}...`);
    for (const record of records[kind]) {
      try {
        const done = await downloadRecord(record);
        downloaded[kind].push(done);
        console.log(`  ✓ ${record.name}`);
      } catch (e) {
        failures.push({
          kind,
          name: record.name,
          slug: record.slug,
          url: record.url,
          error: e.message,
        });
        console.error(`  ✗ ${record.name}: ${e.message}`);
      }
    }
  }

  await writeManifest('manifest-items.json', {
    sourcePages: { items: PAGES.items },
    generatedAt: new Date().toISOString(),
    count: downloaded.items.length,
    items: downloaded.items,
  });

  await writeManifest('manifest-runes.json', {
    sourcePages: { runes: PAGES.runes },
    generatedAt: new Date().toISOString(),
    count: downloaded.runes.length,
    runes: downloaded.runes,
  });

  await writeManifest('manifest-all.json', {
    sourcePages: PAGES,
    generatedAt: new Date().toISOString(),
    counts: {
      items: downloaded.items.length,
      runes: downloaded.runes.length,
      failures: failures.length,
    },
    items: downloaded.items,
    runes: downloaded.runes,
    failures,
  });

  console.log(`\nDone.`);
  console.log(`Items downloaded: ${downloaded.items.length}`);
  console.log(`Runes downloaded: ${downloaded.runes.length}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

await main();
