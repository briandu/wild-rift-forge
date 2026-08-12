import { Router } from 'express';
import { getChampionBySlug, listChampions } from '@wild-rift-forge/database';

export const championsRouter = Router();

championsRouter.get('/', async (_req, res) => {
  try {
    const champions = await listChampions();
    res.json({ champions });
  } catch (err) {
    // Empty roster when DB is unavailable — web falls back to local demo champions.
    console.warn('listChampions failed:', err instanceof Error ? err.message : err);
    res.json({ champions: [] });
  }
});

championsRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    try {
      const champion = await getChampionBySlug(slug);
      if (!champion) {
        res.status(404).json({ error: 'Champion not found' });
        return;
      }
      res.json({ champion });
    } catch (err) {
      console.warn('getChampionBySlug failed:', err instanceof Error ? err.message : err);
      res.status(404).json({ error: 'Champion not found' });
    }
  } catch (err) {
    next(err);
  }
});
