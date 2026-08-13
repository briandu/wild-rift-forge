import { Router } from 'express';
import { getLatestPatchPayload } from '../payloads.js';

export const patchesRouter = Router();

patchesRouter.get('/latest', async (_req, res, next) => {
  try {
    const payload = await getLatestPatchPayload();
    if (!payload) {
      res.status(404).json({ error: 'No patches stored' });
      return;
    }
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
