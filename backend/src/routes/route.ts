import { Router } from 'express';
import type { Mode } from '../graph/types.js';
import { computeRoute } from '../services/routingService.js';

const VALID_MODES: Mode[] = ['walk', 'bike', 'motorcycle', 'car'];

export const routeRouter = Router();

routeRouter.post('/route', async (req, res) => {
  const { originLat, originLng, destLat, destLng, mode } = req.body ?? {};

  if (
    typeof originLat !== 'number' ||
    typeof originLng !== 'number' ||
    typeof destLat !== 'number' ||
    typeof destLng !== 'number' ||
    !VALID_MODES.includes(mode)
  ) {
    res.status(400).json({
      error: 'originLat, originLng, destLat, destLng (numbers) and mode (walk|bike|motorcycle|car) are required',
    });
    return;
  }

  try {
    const result = await computeRoute({ originLat, originLng, destLat, destLng, mode });
    if (!result) {
      res.status(404).json({ error: 'No route found' });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Routing failed' });
  }
});
