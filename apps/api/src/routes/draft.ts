import { Router } from 'express';
import { getIconSignaturesPayload } from '../payloads.js';

export const draftRouter = Router();

draftRouter.get('/icon-signatures', async (_req, res, next) => {
  try {
    // Public, derived from public art, and changes only when the scraper runs.
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.json(await getIconSignaturesPayload());
  } catch (err) {
    next(err);
  }
});
