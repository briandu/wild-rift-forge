import type { Champion, ChampionAbility } from '@wild-rift-forge/game-data';
import {
  insertRawSource,
  replaceChampionAbilities,
  upsertChampion,
} from '@wild-rift-forge/database';
import { fetchHtml } from '../fetchers/fetch-html';
import { parseChampionList } from '../sources/riot/champions/list.parser';
import { parseChampionDetail } from '../sources/riot/champions/detail.parser';
import { PARSER_VERSION } from './ingest-patch';

const CHAMPIONS_URL = 'https://wildrift.leagueoflegends.com/en-us/champions/';

/**
 * Sync the champion roster. The listing page provides name/slug for the whole
 * roster in one request. Detail pages supply title/roles/difficulty, the
 * default skin splash (Available Skins → first image), and the ability kit.
 * Detail is fetched for up to `detailLimit` champions per run to stay polite;
 * list-card art is kept only as a temporary fallback until a detail page is scraped.
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
  let skinImages = 0;
  let abilityKits = 0;
  for (const entry of roster) {
    const champion: Champion = {
      slug: entry.slug,
      name: toDisplayName(entry.name),
      title: null,
      roles: [],
      difficulty: null,
      // List-card art seeds brand-new rows only; image_source_url is set from
      // Available Skins once the detail page is scraped (never clobber a skin URL).
      imageUrl: entry.imageUrl,
      imageSourceUrl: null,
    };

    let abilities: ChampionAbility[] | null = null;
    if (detailed < detailLimit) {
      try {
        const detailPage = await fetchHtml(entry.url);
        const detail = parseChampionDetail(detailPage.body);
        champion.title = detail.title;
        champion.roles = detail.roles;
        champion.difficulty = detail.difficulty;
        if (detail.defaultSkinImageUrl) {
          champion.imageUrl = detail.defaultSkinImageUrl;
          champion.imageSourceUrl = detail.defaultSkinImageUrl;
          skinImages += 1;
        } else if (entry.imageUrl) {
          // Detail page had no skins carousel — keep the list card as source.
          champion.imageSourceUrl = entry.imageUrl;
        }
        abilities = detail.abilities;
        detailed += 1;
      } catch (error) {
        console.warn(`Detail fetch failed for ${entry.slug}: ${String(error)}`);
      }
    }

    const championId = await upsertChampion(champion);
    if (abilities?.length) {
      await replaceChampionAbilities(championId, abilities);
      abilityKits += 1;
    }
    upserted += 1;
  }
  console.log(
    `Champion sync complete: ${upserted} upserted, ${detailed} with detail data, ${skinImages} default skin images, ${abilityKits} ability kits.`,
  );
}

/** "AATROX" -> "Aatrox", "KAI'SA" -> "Kai'Sa". */
function toDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'‘’-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
}
