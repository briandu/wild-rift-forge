import type { Champion } from '@wild-rift-forge/game-data';
import { insertRawSource, upsertChampion } from '@wild-rift-forge/database';
import { fetchHtml } from '../fetchers/fetch-html';
import { parseChampionList } from '../sources/riot/champions/list.parser';
import { parseChampionDetail } from '../sources/riot/champions/detail.parser';
import { PARSER_VERSION } from './ingest-patch';

const CHAMPIONS_URL = 'https://wildrift.leagueoflegends.com/en-us/champions/';

/**
 * Sync the champion roster. The listing page provides name/slug/image for the
 * whole roster in one request; detail pages (title, roles, difficulty) are
 * fetched for up to `detailLimit` champions per run to stay polite.
 */
export async function syncChampions(detailLimit: number): Promise<void> {
  console.log('Fetching champion roster...');
  const listPage = await fetchHtml(CHAMPIONS_URL);
  const roster = parseChampionList(listPage.body);
  console.log(`Roster contains ${roster.length} champions.`);

  await insertRawSource({
    sourceType: 'riot-champion-list',
    url: listPage.url,
    contentHash: listPage.contentHash,
    contentType: listPage.contentType,
    rawBody: listPage.body,
    parserVersion: PARSER_VERSION,
  });

  let upserted = 0;
  let detailed = 0;
  for (const entry of roster) {
    const champion: Champion = {
      slug: entry.slug,
      name: toDisplayName(entry.name),
      title: null,
      roles: [],
      difficulty: null,
      imageUrl: entry.imageUrl,
    };

    if (detailed < detailLimit) {
      try {
        const detailPage = await fetchHtml(entry.url);
        const detail = parseChampionDetail(detailPage.body);
        champion.title = detail.title;
        champion.roles = detail.roles;
        champion.difficulty = detail.difficulty;
        detailed += 1;
      } catch (error) {
        console.warn(`Detail fetch failed for ${entry.slug}: ${String(error)}`);
      }
    }

    await upsertChampion(champion);
    upserted += 1;
  }
  console.log(`Champion sync complete: ${upserted} upserted, ${detailed} with detail data.`);
}

/** "AATROX" -> "Aatrox", "KAI'SA" -> "Kai'Sa". */
function toDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'‘’-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}
