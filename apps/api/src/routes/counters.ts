import { Router } from 'express';
import { getChampionBySlug, listChampions } from '@wild-rift-forge/database';
import { getStubCounters } from '../stubs/counters.js';

export const countersRouter = Router();

countersRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }

    let champion: Awaited<ReturnType<typeof getChampionBySlug>> = null;
    try {
      champion = await getChampionBySlug(slug);
    } catch (err) {
      console.warn('getChampionBySlug failed:', err instanceof Error ? err.message : err);
    }

    const splashes = await championSplashMap();
    const enemyName = champion?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
    const counters = getStubCounters(slug, enemyName);

    res.json({
      ...counters,
      picks: withSplash(counters.picks, splashes),
      enemy: champion
        ? {
            slug: champion.slug,
            name: champion.name,
            title: champion.title,
            roles: champion.roles,
            imageUrl: champion.imageUrl,
          }
        : {
            slug,
            name: enemyName,
            title: null,
            roles: [] as string[],
            imageUrl: null as string | null,
          },
    });
  } catch (err) {
    next(err);
  }
});

async function championSplashMap(): Promise<Map<string, string>> {
  try {
    const champions = await listChampions();
    return new Map(
      champions.flatMap((champion) =>
        champion.imageUrl ? [[champion.slug, champion.imageUrl] as const] : [],
      ),
    );
  } catch (err) {
    console.warn('listChampions failed:', err instanceof Error ? err.message : err);
    return new Map();
  }
}

function withSplash<T extends { slug: string }>(
  rows: T[],
  splashes: Map<string, string>,
): Array<T & { imageUrl: string | null }> {
  return rows.map((row) => ({ ...row, imageUrl: splashes.get(row.slug) ?? null }));
}
