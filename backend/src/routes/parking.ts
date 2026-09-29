import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { listParkingSpots, updateParkingSpotStatus, type ParkingStatus } from '../db/parkingSpotsRepo.js';
import {
  listParkingLotsWithCounts,
  findParkingLotById,
  listSpotsForLot,
  createParkingLot,
  createParkingSpot,
} from '../db/parkingLotsRepo.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const VALID_STATUSES: ParkingStatus[] = ['free', 'occupied', 'unknown'];

export const parkingRouter = Router();

// Plain !== leaks timing information byte-by-byte; timingSafeEqual doesn't,
// but throws on a length mismatch, so that has to be checked first.
function isValidSensorKey(provided: string | undefined): boolean {
  const expected = process.env.SENSOR_API_KEY;
  if (!expected || !provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

// Public: lot-level free/occupied/unknown counts for the map UI. Counts are
// derived from the individual sensor-backed spots, so a lot with no spots
// installed yet reads as all-zero rather than being absent.
parkingRouter.get('/parking-lots', async (_req, res) => {
  try {
    const lots = await listParkingLotsWithCounts();
    res.json(lots);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list parking lots' });
  }
});

// Public: per-spot breakdown within one lot, which is what drives a level-by-level view.
parkingRouter.get('/parking-lots/:id/spots', async (req, res) => {
  try {
    const lot = await findParkingLotById(req.params.id);
    if (!lot) {
      res.status(404).json({ error: 'Parking lot not found' });
      return;
    }
    res.json({ lot, spots: await listSpotsForLot(lot.id) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list lot spots' });
  }
});

// Admin-only: lots and spots are campus infrastructure, curated like places are.
parkingRouter.post('/parking-lots', requireAuth, requireAdmin, async (req, res) => {
  const { name, lat, lng, permitTier } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'name (string), lat and lng (numbers) are required' });
    return;
  }
  try {
    const lot = await createParkingLot({
      name: name.trim(),
      lat,
      lng,
      permitTier: typeof permitTier === 'string' && permitTier.trim() ? permitTier.trim() : null,
    });
    res.status(201).json(lot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create parking lot' });
  }
});

parkingRouter.post('/parking-spots', requireAuth, requireAdmin, async (req, res) => {
  const { lotId, label, level, lat, lng } = req.body ?? {};
  if (typeof label !== 'string' || !label.trim() || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'label (string), lat and lng (numbers) are required' });
    return;
  }
  try {
    const spot = await createParkingSpot({
      lotId: typeof lotId === 'string' && lotId ? lotId : null,
      label: label.trim(),
      level: typeof level === 'string' && level.trim() ? level.trim() : null,
      lat,
      lng,
    });
    res.status(201).json(spot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create parking spot' });
  }
});

// Public: the map UI reads current spot status.
parkingRouter.get('/parking-spots', async (_req, res) => {
  try {
    const spots = await listParkingSpots();
    res.json(spots);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list parking spots' });
  }
});

// Sensor-authenticated: only the pilot sensor (or a manual test script) posts status updates.
// A shared API key is enough for the one-sensor pilot; revisit if/when there are many sensors.
parkingRouter.post('/parking-spots/:id/status', async (req, res) => {
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
