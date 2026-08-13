import { Router } from 'express';
import { getTiersPayload } from '../payloads.js';

export const tiersRouter = Router();

tiersRouter.get('/', async (req, res) => {
  res.json(await getTiersPayload({ bracket: req.query.bracket, lane: req.query.lane }));
});
