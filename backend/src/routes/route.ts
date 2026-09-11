import { Router } from 'express';
import { computeRoute } from '../services/routingService.js';
import { parseRouteRequestBody } from './routeRequest.js';

export const routeRouter = Router();

routeRouter.post('/route', async (req, res) => {
  const parsed = parseRouteRequestBody(req.body);
  if (!parsed) {
    res.status(400).json({
      error: 'originLat, originLng, destLat, destLng (numbers) and travelMode (walk|bike|motorcycle|car) are required',
    });
    return;
  }

  try {
    const result = await computeRoute(parsed);
    if (!result) {
      res.status(404).json({ error: 'No route found' });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Routing failed' });
  }
});
