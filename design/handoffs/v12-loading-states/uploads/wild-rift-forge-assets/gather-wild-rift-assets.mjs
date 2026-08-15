#!/usr/bin/env node
/**
 * Wild Rift Forge asset gatherer
 *
 * Run from the folder containing this file:
 *   npm i --no-save sharp
 *   node gather-wild-rift-assets.mjs
 *
 * Output: ./uploads/
 * Existing files are skipped. Pass --force to overwrite them.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('\nMissing dependency: sharp');
  console.error('Run: npm i --no-save sharp\n');
  process.exit(1);
}

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'uploads');
const FORCE = process.argv.includes('--force');

const ABILITY_CHAMPIONS = [
  'garen', 'darius',
  'sett', 'volibear', 'renekton', 'ashe',
  'ahri', 'yasuo', 'jinx', 'camille', 'fiora', 'malphite', 'jax', 'irelia',
  'caitlyn', 'draven', 'vayne', 'nasus', 'teemo', 'leona', 'braum', 'rammus',
];

const SPLASH_CHAMPIONS = [
  'garen', 'darius', 'ahri', 'yasuo', 'jinx', 'camille', 'fiora', 'malphite',
  'jax', 'irelia', 'caitlyn', 'draven', 'vayne', 'nasus', 'teemo', 'leona',
  'braum', 'rammus',
];

const STATIC_ASSETS = [
  // Runes
  ['rune-conqueror.png', 'https://assets.riftgg.app/runes/conqueror.webp', 'icon'],
  ['rune-bone-plating.png', 'https://assets.riftgg.app/runes/bone-plating.webp', 'icon'],
  // Hunter - Titan was replaced in WR 4.2, so this intentionally uses a legacy WR asset.
  ['rune-hunter-titan.png', 'https://wildriftguides.gg/img/wildrift/runes/HunterTitan.png', 'icon'],

  // Items
  ['item-trinity-force.png', 'https://assets.riftgg.app/items/trinity-force.webp', 'icon'],
  ['item-plated-steelcaps.png', 'https://assets.riftgg.app/items/plated-steelcaps.webp', 'icon'],
  ['item-steraks-gage.png', 'https://assets.riftgg.app/items/steraks-gage.webp', 'icon'],
  ['item-deaths-dance.png', 'https://assets.riftgg.app/items/deaths-dance.webp', 'icon'],
  ['item-black-cleaver.png', 'https://assets.riftgg.app/items/black-cleaver.webp', 'icon'],
  ['item-mercurys-treads.png', 'https://assets.riftgg.app/items/mercurys-treads.webp', 'icon'],
  ['item-ionian-boots.png', 'https://assets.riftgg.app/items/ionian-boots-of-lucidity.webp', 'icon'],
  // Spirit Visage was removed in WR 7.0, so this intentionally uses a legacy WR asset.
  ['item-spirit-visage.png', 'https://wildriftguides.gg/img/wildrift/items/74/spirit-visage.webp', 'icon'],
  ['item-randuins-omen.png', 'https://assets.riftgg.app/items/randuins-omen.webp', 'icon'],
  ['item-force-of-nature.png', 'https://assets.riftgg.app/items/force-of-nature.webp', 'icon'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

function htmlDecodeBasic(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('\\u002F', '/')
    .replaceAll('\\/', '/');
}

async function fetchBuffer(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 WildRiftForgeAssetGatherer/1.0',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
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

async function fetchText(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 WildRiftForgeAssetGatherer/1.0',
          'accept': 'text/html,application/xhtml+xml',
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

async function saveIcon(buffer, filename) {
  const dest = path.join(OUT, filename);
  if (!FORCE && await exists(dest)) return 'skip';
  await sharp(buffer)
    .resize(256, 256, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest);
  return 'write';
}

async function saveSplash(buffer, filename) {
  const dest = path.join(OUT, filename);
  if (!FORCE && await exists(dest)) return 'skip';
  await sharp(buffer)
    .resize(1600, 900, { fit: 'cover', position: 'centre', withoutEnlargement: false })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(dest);
  return 'write';
}

function extractNextData(html) {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('__NEXT_DATA__ not found');
  return JSON.parse(match[1]);
}

function pickOfficialData(nextData) {
  const blades = nextData?.props?.pageProps?.page?.blades;
  if (!Array.isArray(blades)) throw new Error('Riot page blades not found');

  // Structure used by Riot's public Wild Rift champion pages and the
  // @wildrift/champions-api parser. Ability groups are P,Q,W,E,R.
  const abilityGroups = blades?.[2]?.groups;
  const skinGroups = blades?.[4]?.groups;

  const abilityUrls = Array.isArray(abilityGroups)
    ? abilityGroups.slice(0, 5).map((g) => g?.thumbnail?.url).filter(Boolean)
    : [];
  const baseSkinUrl = Array.isArray(skinGroups) ? skinGroups?.[0]?.thumbnail?.url : undefined;

  return { abilityUrls, baseSkinUrl };
}

function absoluteAssetUrl(url) {
  if (!url) return url;
  const u = htmlDecodeBasic(url);
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `https://wildrift.leagueoflegends.com${u}`;
  return u;
}

async function riotChampionData(champ) {
  const url = `https://wildrift.leagueoflegends.com/en-us/champions/${champ}/`;
  const html = await fetchText(url);
  const data = pickOfficialData(extractNextData(html));
  return {
    abilityUrls: data.abilityUrls.map(absoluteAssetUrl),
    baseSkinUrl: absoluteAssetUrl(data.baseSkinUrl),
  };
}

async function riftGgAbilityFallback(champ) {
  const htmlRaw = await fetchText(`https://www.riftgg.app/en/champions/${champ}`);
  const html = htmlDecodeBasic(htmlRaw);
  const start = Math.max(0, html.indexOf('Level Order'));
  const endIdx = html.indexOf('Runes & Keystones', start);
  const section = html.slice(start, endIdx > start ? endIdx : undefined);
  const re = new RegExp(`https://assets\\.riftgg\\.app/champions/abilities/${champ}/[^"'\\s<>]+?\\.webp`, 'g');
  const matches = [...section.matchAll(re)].map((m) => m[0]);
  const unique = [...new Set(matches)];
  if (unique.length < 5) {
    throw new Error(`RiftGG fallback found ${unique.length}/5 ability URLs for ${champ}`);
  }
  return unique.slice(0, 5);
}

async function getAbilityUrls(champ) {
  try {
    const official = await riotChampionData(champ);
    if (official.abilityUrls.length === 5) return { urls: official.abilityUrls, source: 'Riot' };
  } catch (e) {
    console.warn(`  Riot ability parse failed for ${champ}: ${e.message}`);
  }
  return { urls: await riftGgAbilityFallback(champ), source: 'RiftGG fallback' };
}

async function getSplashUrl(champ) {
  try {
    const official = await riotChampionData(champ);
    if (official.baseSkinUrl) return { url: official.baseSkinUrl, source: 'Riot' };
  } catch (e) {
    console.warn(`  Riot splash parse failed for ${champ}: ${e.message}`);
  }
  return {
    url: `https://assets.riftgg.app/champions/poster/${champ}.jpg`,
    source: 'RiftGG fallback',
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const failures = [];
  let written = 0;
  let skipped = 0;

  console.log(`\nWild Rift Forge asset gatherer`);
  console.log(`Output: ${OUT}`);
  console.log(FORCE ? 'Mode: overwrite existing files' : 'Mode: skip existing files');

  console.log('\n[1/3] Runes + items');
  for (const [filename, url, kind] of STATIC_ASSETS) {
    try {
      const dest = path.join(OUT, filename);
      if (!FORCE && await exists(dest)) { skipped++; console.log(`  ✓ ${filename} (already exists)`); continue; }
      const buffer = await fetchBuffer(url);
      const result = kind === 'icon' ? await saveIcon(buffer, filename) : await saveSplash(buffer, filename);
      result === 'write' ? written++ : skipped++;
      console.log(`  ✓ ${filename}`);
    } catch (e) {
      failures.push([filename, e.message]);
      console.error(`  ✗ ${filename}: ${e.message}`);
    }
  }

  console.log('\n[2/3] Champion abilities');
  const slots = ['passive', 'q', 'w', 'e', 'r'];
  for (const champ of ABILITY_CHAMPIONS) {
    const expected = slots.map((slot) => `${champ}-${slot}.png`);
    if (!FORCE && (await Promise.all(expected.map((f) => exists(path.join(OUT, f))))).every(Boolean)) {
      skipped += 5;
      console.log(`  ✓ ${champ} (all 5 already exist)`);
      continue;
    }
    try {
      const { urls, source } = await getAbilityUrls(champ);
      console.log(`  ${champ}: ${source}`);
      for (let i = 0; i < 5; i++) {
        const filename = expected[i];
        try {
          const dest = path.join(OUT, filename);
          if (!FORCE && await exists(dest)) { skipped++; continue; }
          const buffer = await fetchBuffer(urls[i]);
          const result = await saveIcon(buffer, filename);
          result === 'write' ? written++ : skipped++;
        } catch (e) {
          failures.push([filename, e.message]);
          console.error(`    ✗ ${filename}: ${e.message}`);
        }
      }
    } catch (e) {
      for (const filename of expected) {
        if (!(await exists(path.join(OUT, filename)))) failures.push([filename, e.message]);
      }
      console.error(`  ✗ ${champ}: ${e.message}`);
    }
  }

  console.log('\n[3/3] Champion splash art');
  for (const champ of SPLASH_CHAMPIONS) {
    const filename = `splash-${champ}.jpg`;
    const dest = path.join(OUT, filename);
    if (!FORCE && await exists(dest)) { skipped++; console.log(`  ✓ ${filename} (already exists)`); continue; }
    try {
      const { url, source } = await getSplashUrl(champ);
      const buffer = await fetchBuffer(url);
      const result = await saveSplash(buffer, filename);
      result === 'write' ? written++ : skipped++;
      console.log(`  ✓ ${filename} (${source})`);
    } catch (e) {
      failures.push([filename, e.message]);
      console.error(`  ✗ ${filename}: ${e.message}`);
    }
  }

  console.log(`\nDone. Wrote ${written}, skipped ${skipped}, failures ${failures.length}.`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const [file, message] of failures) console.log(`  - ${file}: ${message}`);
    process.exitCode = 2;
  }
}

await main();
