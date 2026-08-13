import { Router } from 'express';
import { getCountersPayload } from '../payloads.js';

export const countersRouter = Router();

countersRouter.get('/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    res.json(await getCountersPayload(slug));
  } catch (err) {
    next(err);
  }
});
