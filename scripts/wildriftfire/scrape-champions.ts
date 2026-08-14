import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { wrfChampionSchema, wrfIndexEntrySchema, type WrfChampion, type WrfIndexEntry } from '@wild-rift-forge/game-data';
import { fetchHtml } from '../../apps/scraper/src/fetchers/fetch-html.ts';
import {
  mergeChampionIndex,
  parseIndexFromFooter,
  parseIndexFromHome,
} from '../../apps/scraper/src/sources/wildriftfire/champion-index.ts';
import {
  extractChampionPage,
  normalizeChampionPage,
} from '../../apps/scraper/src/sources/wildriftfire/champion-page.ts';
import { normalizeAbility } from '../../apps/scraper/src/sources/wildriftfire/normalize-ability.ts';
import type { RawAbilityBlock } from '../../apps/scraper/src/sources/wildriftfire/types.ts';
import {
  normalizedChampionPath,
  normalizedCollectionPath,
  rawWrfDir,
  reportsDir,
  scrapeDate,
  wrfIndexPath,
} from './paths';

const HOME_URL = 'https://www.wildriftfire.com/';

function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function discoverIndex(): Promise<WrfIndexEntry[]> {
  const home = await fetchHtml(HOME_URL);
  const merged = mergeChampionIndex(parseIndexFromHome(home.body), parseIndexFromFooter(home.body));
  return merged.map((entry) => wrfIndexEntrySchema.parse(entry));
}

export async function scrapeOne(entry: WrfIndexEntry, scrapedAt: string): Promise<WrfChampion> {
  const page = await fetchHtml(entry.url);
  const raw = extractChampionPage(page.body, page.url || entry.url);
  if (!raw.id) {
    raw.id = entry.id;
  }
  if (!raw.name) {
    raw.name = entry.name;
  }
  const champion = normalizeChampionPage(raw, scrapedAt, page.url || entry.url);
  return wrfChampionSchema.parse(champion);
}

async function writeReports(champions: WrfChampion[]): Promise<void> {
  const dir = reportsDir();
  await mkdir(dir, { recursive: true });
  const gaps = champions
    .filter((champion) => champion.gaps.length > 0 || champion.parseWarnings.length > 0)
    .map((champion) => ({
      champion: champion.id,
      sourceUrl: champion.source.url,
      observedPatch: champion.source.observedPatch,
      missing: champion.gaps.filter((gap) => gap.kind === 'missing_from_source').map((gap) => gap.field),
      parseWarnings: [
        ...champion.parseWarnings,
        ...champion.gaps.filter((gap) => gap.kind === 'parser_failed').map((gap) => `${gap.field}: ${gap.detail}`),
      ],
    }));
  const review = champions
    .filter((champion) =>
      Object.values(champion.abilities).some((ability) => ability.confidence === 'manual_review') ||
      champion.extraAbilities.some((ability) => ability.confidence === 'manual_review'),
    )
    .map((champion) => ({
      id: champion.id,
      name: champion.name,
      observedPatch: champion.source.observedPatch,
      reasons: [
        ...Object.values(champion.abilities)
          .filter((ability) => ability.confidence === 'low' || ability.confidence === 'manual_review')
          .map((ability) => `${ability.slot} confidence=${ability.confidence}`),
        ...champion.extraAbilities.map((ability) => `extra ${ability.name} confidence=${ability.confidence}`),
      ],
    }));
  await writeFile(path.join(dir, 'wildriftfire-champion-gaps.json'), `${JSON.stringify(gaps, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dir, 'wildriftfire-manual-review.json'), `${JSON.stringify(review, null, 2)}\n`, 'utf8');
}

function rawFromStored(ability: WrfChampion['abilities']['q']): RawAbilityBlock {
  return {
    slotKey: ability.slot,
    slot: ability.slot,
    name: ability.name,
    form: ability.form,
    iconUrl: null,
    cooldown: ability.cooldown,
    costValues: ability.cost?.values ?? null,
    paragraphs: ability.rawParsedText.split(/\n\n+/),
    sourceText: ability.rawParsedText,
  };
}

function reprocessChampion(champion: WrfChampion): WrfChampion {
  const resource = champion.stats.resource.type;
  const parseWarnings: string[] = [];
  const abilities = { ...champion.abilities };
  for (const slot of ['passive', 'q', 'w', 'e', 'r'] as const) {
    const { ability, warnings } = normalizeAbility(rawFromStored(champion.abilities[slot]), slot, resource);
    abilities[slot] = ability;
    parseWarnings.push(...warnings);
  }
  const extraAbilities = champion.extraAbilities.map((row) => {
    const { ability, warnings } = normalizeAbility(rawFromStored(row), row.slot, resource);
    parseWarnings.push(...warnings);
    return ability;
  });
  const gaps = champion.gaps.filter((gap) => gap.kind === 'missing_from_source' && !gap.field.endsWith('.effects'));
  for (const slot of ['passive', 'q', 'w', 'e', 'r'] as const) {
    const ability = abilities[slot];
    if (ability.confidence === 'manual_review') {
      gaps.push({
        field: `${slot}.effects`,
        kind: 'parser_failed',
        detail: `Ability normalize confidence is ${ability.confidence}.`,
      });
    }
  }
  return { ...champion, abilities, extraAbilities, parseWarnings, gaps };
}

export async function runScrape(): Promise<void> {
  const only = getFlag('id');
  const limit = Number(getFlag('limit') ?? 0);
  const force = hasFlag('force');
  const reprocess = hasFlag('reprocess');
  const date = scrapeDate();
  const scrapedAt = new Date().toISOString();
  const rawDir = rawWrfDir(date);
  await mkdir(rawDir, { recursive: true });
  await mkdir(path.dirname(normalizedChampionPath('_')), { recursive: true });

  if (reprocess) {
    const dir = path.dirname(normalizedChampionPath('_'));
    const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
    const collection: WrfChampion[] = [];
    for (const file of files) {
      const parsed = wrfChampionSchema.safeParse(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
      if (!parsed.success) {
        continue;
      }
      const next = wrfChampionSchema.parse(reprocessChampion(parsed.data));
      await writeFile(normalizedChampionPath(next.id), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      collection.push(next);
    }
    await writeFile(normalizedCollectionPath(), `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
    await writeReports(collection);
    console.log(`Reprocessed ${collection.length} champions from stored WildRiftFire text.`);
    return;
  }

  let index = await discoverIndex();
  await mkdir(path.dirname(wrfIndexPath()), { recursive: true });
  await writeFile(wrfIndexPath(), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(`Discovered ${index.length} WildRiftFire guides.`);

  if (only) {
    index = index.filter((entry) => entry.id === only);
    if (index.length === 0) {
      index = [{ id: only, name: only, url: `https://www.wildriftfire.com/guide/${only}` }];
    }
  } else if (limit > 0) {
    index = index.slice(0, limit);
  }

  const champions: WrfChampion[] = [];
  for (const entry of index) {
    const rawPath = path.join(rawDir, `${entry.id}.json`);
    const outPath = normalizedChampionPath(entry.id);
    if (!force) {
      try {
        const existing = wrfChampionSchema.parse(JSON.parse(await readFile(outPath, 'utf8')));
        champions.push(existing);
        console.log(`skip  ${entry.id} (already normalized; pass --force to refetch)`);
        continue;
      } catch {
        // scrape
      }
    }
    try {
      const champion = await scrapeOne(entry, scrapedAt);
      await writeFile(rawPath, `${JSON.stringify({ id: champion.id, source: champion.source, stats: champion.stats, abilityNames: Object.values(champion.abilities).map((ability) => ability.name) }, null, 2)}\n`, 'utf8');
      await writeFile(outPath, `${JSON.stringify(champion, null, 2)}\n`, 'utf8');
      champions.push(champion);
      console.log(`ok    ${entry.id}  patch=${champion.source.observedPatch ?? 'null'}  extras=${champion.extraAbilities.length}`);
    } catch (error) {
      console.error(`fail  ${entry.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const allIds = (await readdir(path.dirname(normalizedChampionPath('_'))))
    .filter((file) => file.endsWith('.json') && file !== 'champions.json');
  const collection: WrfChampion[] = [];
  for (const file of allIds.sort()) {
    if (file.includes(path.sep)) {
      continue;
    }
    try {
      collection.push(wrfChampionSchema.parse(JSON.parse(await readFile(normalizedChampionPath(file.replace(/\.json$/, '')), 'utf8'))));
    } catch {
      // skip the 7.2c directory and invalid leftovers
    }
  }
  await writeFile(normalizedCollectionPath(), `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
  await writeReports(collection);
  console.log(`Wrote ${collection.length} normalized champions and reports.`);
}

if (process.argv[1] && process.argv[1].includes('scrape-champions')) {
  runScrape().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
