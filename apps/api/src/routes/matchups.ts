import { Router } from 'express';
import { TIER_LANES, type TierLane } from '@wild-rift-forge/game-data';
import { ensureMatchupGuide } from '../generate-matchup.js';
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
    if (!payload.guide) {
      const lane = TIER_LANES.includes(payload.lane as TierLane)
        ? (payload.lane as TierLane)
        : 'Top';
      void ensureMatchupGuide({ you: payload.you.slug, them: payload.them.slug, lane }).catch(
        (err) => {
          console.warn('ensureMatchupGuide failed:', err instanceof Error ? err.message : err);
        },
      );
    }
  } catch (err) {
    next(err);
  }
});
