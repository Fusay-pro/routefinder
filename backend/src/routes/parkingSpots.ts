import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { listParkingSpots, updateParkingSpotStatus, type ParkingStatus } from '../db/parkingSpotsRepo.js';

const VALID_STATUSES: ParkingStatus[] = ['free', 'occupied', 'unknown'];

export const parkingSpotsRouter = Router();

// Plain !== leaks timing information byte-by-byte; timingSafeEqual doesn't,
// but throws on a length mismatch, so that has to be checked first.
function isValidSensorKey(provided: string | undefined): boolean {
  const expected = process.env.SENSOR_API_KEY;
  if (!expected || !provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

// Public: the map UI reads current spot status.
parkingSpotsRouter.get('/parking-spots', async (_req, res) => {
  try {
    const spots = await listParkingSpots();
    res.json(spots);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list parking spots' });
  }
});

// Sensor-authenticated: only the pilot sensor (or a manual test script) posts status updates.
// A shared API key is enough for the one-sensor pilot; revisit if/when there are many sensors.
parkingSpotsRouter.post('/parking-spots/:id/status', async (req, res) => {
  if (!isValidSensorKey(req.header('X-Sensor-Key'))) {
    res.status(401).json({ error: 'Invalid or missing sensor key' });
    return;
  }

  const { status } = req.body ?? {};
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'status (free|occupied|unknown) is required' });
    return;
  }

  try {
    const spot = await updateParkingSpotStatus(req.params.id, status);
    if (!spot) {
      res.status(404).json({ error: 'Parking spot not found' });
      return;
    }
    res.json(spot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update parking spot' });
  }
});
