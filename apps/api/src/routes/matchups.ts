import { Router } from 'express';
import { getMatchupPayload } from '../payloads.js';

export const matchupsRouter = Router();

matchupsRouter.get('/', async (req, res, next) => {
  try {
    const payload = await getMatchupPayload({
      you: req.query.you,
      them: req.query.them,
      lane: req.query.lane,
    });
    if (!payload) {
      res.status(400).json({ error: 'you and them slugs are required' });
      return;
    }
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
