import { Router } from 'express';
import { getCurrentWeather } from '../services/weatherService.js';
import { CAMPUS_CENTER } from '../services/campus.js';

export const weatherRouter = Router();

// Public: conditions drive the "good day to bike" prompt, so it's read before
// anyone has signed in. Defaults to campus, since that's where nearly every
// trip in this app starts or ends.
weatherRouter.get('/weather', async (req, res) => {
  const { lat, lng } = req.query;

  const hasCoords = lat !== undefined || lng !== undefined;
  const parsedLat = hasCoords ? Number(lat) : CAMPUS_CENTER.lat;
  const parsedLng = hasCoords ? Number(lng) : CAMPUS_CENTER.lng;

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    res.status(400).json({ error: 'lat and lng must both be numbers when provided' });
    return;
  }

  try {
    res.json(await getCurrentWeather(parsedLat, parsedLng));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Weather lookup failed' });
  }
});
