import { Router } from 'express';
import { getChampionBySlug } from '@wild-rift-forge/database';
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

    const enemyName = champion?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
    const counters = getStubCounters(slug, enemyName);

    res.json({
      ...counters,
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
