import { Router } from 'express';
import { computeRoute } from '../services/routingService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createTrip,
  findTripById,
  listTripsForUser,
  countVerifiedTripsToday,
  completeTripAndAwardPoints,
} from '../db/tripsRepo.js';
import { verifyTrip, traceDistanceMeters, traceDurationSeconds, type GpsPoint, type RoutePoint } from '../services/tripVerification.js';
import { calculatePoints, DAILY_REWARD_TRIP_CAP } from '../services/rewardsService.js';
import { parseRouteRequestBody } from './routeRequest.js';

export const tripsRouter = Router();

// Start a trip: computes the suggested route (same engine as /route) and
// persists it so /trips/:id/complete has something to verify a GPS trace against.
tripsRouter.post('/trips', requireAuth, async (req, res) => {
  const parsed = parseRouteRequestBody(req.body);
  if (!parsed) {
    res.status(400).json({
      error: 'originLat, originLng, destLat, destLng (numbers) and travelMode (walk|bike|motorcycle|car) are required',
    });
    return;
  }
  const { originLat, originLng, destLat, destLng, travelMode } = parsed;
  const { originPlaceId, destinationPlaceId } = req.body ?? {};

  try {
    const routeResult = await computeRoute(parsed);
    if (!routeResult) {
      res.status(404).json({ error: 'No route found' });
      return;
    }

    const trip = await createTrip({
      userId: res.locals.userId as string,
      travelMode,
      originPlaceId: typeof originPlaceId === 'string' ? originPlaceId : null,
      originLat,
      originLng,
      destinationPlaceId: typeof destinationPlaceId === 'string' ? destinationPlaceId : null,
      destinationLat: destLat,
      destinationLng: destLng,
      suggestedRoute: routeResult,
      distanceMeters: routeResult.distanceMeters,
      estimatedSeconds: routeResult.seconds,
    });

    res.status(201).json(trip);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to start trip' });
  }
});

// Travel history — trips are already one row per journey, so this is just a list.
tripsRouter.get('/trips', requireAuth, async (_req, res) => {
  try {
    const trips = await listTripsForUser(res.locals.userId as string);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list trips' });
  }
});

function isValidGpsTrace(value: unknown): value is GpsPoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof (p as GpsPoint).lat === 'number' &&
        typeof (p as GpsPoint).lng === 'number' &&
        typeof (p as GpsPoint).t === 'string'
    )
  );
}

tripsRouter.post('/trips/:id/complete', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  try {
    const trip = await findTripById(req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    if (trip.userId !== userId) {
      res.status(403).json({ error: 'Not your trip' });
      return;
    }
    if (trip.status !== 'in_progress') {
      res.status(409).json({ error: 'Trip is already completed' });
      return;
    }

    const { gpsTrace } = req.body ?? {};

    // Lost GPS mid-trip (app closed, signal lost): save as an unverified
    // partial record — no points, no crash.
    if (!isValidGpsTrace(gpsTrace) || gpsTrace.length < 2) {
      const updated = await completeTripAndAwardPoints(trip.id, userId, {
        status: 'abandoned',
        verificationStatus: 'unverified',
        pointsAwarded: 0,
        gpsTrace: gpsTrace ?? null,
      });
      res.json(updated);
      return;
    }

    const distanceMeters = traceDistanceMeters(gpsTrace);
    const durationSeconds = traceDurationSeconds(gpsTrace);

    const suggestedRoute = trip.suggestedRoute as { source?: string; path?: RoutePoint[] } | null;
    const routePath = suggestedRoute?.source === 'own-graph' ? (suggestedRoute.path ?? null) : null;

    const outcome = verifyTrip(gpsTrace, routePath, trip.travelMode, distanceMeters, durationSeconds);

    let pointsAwarded = 0;
    if (outcome === 'verified') {
      const tripsToday = await countVerifiedTripsToday(userId);
      if (tripsToday < DAILY_REWARD_TRIP_CAP) {
        pointsAwarded = calculatePoints(trip.travelMode, distanceMeters);
      }
    }

    const updated = await completeTripAndAwardPoints(trip.id, userId, {
      status: 'completed',
      verificationStatus: outcome,
      pointsAwarded,
      gpsTrace,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to complete trip' });
  }
});
