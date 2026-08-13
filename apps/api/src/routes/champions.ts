import { Router } from 'express';
import { getChampionPayload, getChampionsPayload } from '../payloads.js';

export const championsRouter = Router();

championsRouter.get('/', async (_req, res) => {
  res.json(await getChampionsPayload());
});

championsRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    const payload = await getChampionPayload(slug);
    if (!payload) {
      res.status(404).json({ error: 'Champion not found' });
      return;
    }
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
