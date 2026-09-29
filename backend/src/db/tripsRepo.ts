import { pool } from './pool.js';
import type { Mode } from '../graph/types.js';

export type TripStatus = 'in_progress' | 'completed' | 'abandoned';
export type VerificationStatus = 'unverified' | 'verified' | 'flagged_review' | 'rejected';

export interface Trip {
  id: string;
  userId: string;
  travelMode: Mode;
  originPlaceId: string | null;
  originLat: number;
  originLng: number;
  destinationPlaceId: string | null;
  destinationLat: number;
  destinationLng: number;
  suggestedRoute: unknown;
  distanceMeters: number;
  estimatedSeconds: number;
  gpsTrace: unknown;
  status: TripStatus;
  verificationStatus: VerificationStatus;
  pointsAwarded: number;
  // What actually happened, from the GPS trace. Null until the trip completes
  // with a usable trace; distanceMeters/estimatedSeconds above are the *plan*.
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  // The part of actualDistanceMeters that counted toward points and the boards.
  scoringDistanceMeters: number | null;
  co2SavedGrams: number | null;
  startedAt: string;
  endedAt: string | null;
}

interface TripRow {
  id: string;
  user_id: string;
  travel_mode: Mode;
  origin_place_id: string | null;
  origin_lat: number;
  origin_lng: number;
  destination_place_id: string | null;
  destination_lat: number;
  destination_lng: number;
  suggested_route: unknown;
  distance_meters: number;
  estimated_seconds: number;
  gps_trace: unknown;
  status: TripStatus;
  verification_status: VerificationStatus;
  points_awarded: number;
  actual_distance_meters: number | null;
  actual_duration_seconds: number | null;
  scoring_distance_meters: number | null;
  co2_saved_grams: number | null;
  started_at: string;
  ended_at: string | null;
}

const SELECT_COLUMNS = `id, user_id, travel_mode, origin_place_id, origin_lat, origin_lng,
  destination_place_id, destination_lat, destination_lng, suggested_route, distance_meters,
  estimated_seconds, gps_trace, status, verification_status, points_awarded,
  actual_distance_meters, actual_duration_seconds, scoring_distance_meters, co2_saved_grams,
  started_at, ended_at`;

function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    travelMode: row.travel_mode,
    originPlaceId: row.origin_place_id,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    destinationPlaceId: row.destination_place_id,
    destinationLat: row.destination_lat,
    destinationLng: row.destination_lng,
    suggestedRoute: row.suggested_route,
    distanceMeters: row.distance_meters,
    estimatedSeconds: row.estimated_seconds,
    gpsTrace: row.gps_trace,
    status: row.status,
    verificationStatus: row.verification_status,
    pointsAwarded: row.points_awarded,
    actualDistanceMeters: row.actual_distance_meters,
    actualDurationSeconds: row.actual_duration_seconds,
    scoringDistanceMeters: row.scoring_distance_meters,
    co2SavedGrams: row.co2_saved_grams,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export interface CreateTripInput {
  userId: string;
  travelMode: Mode;
  originPlaceId: string | null;
  originLat: number;
  originLng: number;
  destinationPlaceId: string | null;
  destinationLat: number;
  destinationLng: number;
  suggestedRoute: unknown;
  distanceMeters: number;
  estimatedSeconds: number;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { rows } = await pool.query<TripRow>(
    `INSERT INTO trips (user_id, travel_mode, origin_place_id, origin_lat, origin_lng,
       destination_place_id, destination_lat, destination_lng, suggested_route,
       distance_meters, estimated_seconds)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${SELECT_COLUMNS}`,
    [
      input.userId,
      input.travelMode,
      input.originPlaceId,
      input.originLat,
      input.originLng,
      input.destinationPlaceId,
      input.destinationLat,
      input.destinationLng,
      JSON.stringify(input.suggestedRoute),
      input.distanceMeters,
      input.estimatedSeconds,
    ]
  );
  return toTrip(rows[0]);
}

export async function findTripById(id: string): Promise<Trip | null> {
  const { rows } = await pool.query<TripRow>(`SELECT ${SELECT_COLUMNS} FROM trips WHERE id = $1`, [id]);
  return rows[0] ? toTrip(rows[0]) : null;
}

export async function listTripsForUser(userId: string, limit = 50): Promise<Trip[]> {
  const { rows } = await pool.query<TripRow>(
    `SELECT ${SELECT_COLUMNS} FROM trips WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map(toTrip);
}

export interface DailyScoringTotals {
  trips: number;
  distanceMeters: number;
}

// Today's totals, for the daily caps in services/scoringRules.ts. Counts only
// trips that actually scored — a verified trip refused for being off campus or
// too short shouldn't burn a day's quota.
//
// Buckets on started_at, so a trip begun before midnight counts against the day
// it started, and on the database's timezone rather than the user's.
export async function scoredTodayForUser(userId: string): Promise<DailyScoringTotals> {
  const { rows } = await pool.query<{ trips: number; distance_meters: number }>(
    `SELECT count(*)::int AS trips,
            COALESCE(sum(scoring_distance_meters), 0)::double precision AS distance_meters
     FROM trips
     WHERE user_id = $1
       AND verification_status = 'verified'
       AND scoring_distance_meters > 0
       AND started_at >= date_trunc('day', now())`,
    [userId]
  );
  return { trips: rows[0]?.trips ?? 0, distanceMeters: rows[0]?.distance_meters ?? 0 };
}

export interface CompleteTripInput {
  status: TripStatus;
  verificationStatus: VerificationStatus;
  pointsAwarded: number;
  gpsTrace: unknown;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  scoringDistanceMeters: number | null;
  co2SavedGrams: number | null;
}

// Completing the trip and crediting points happen in one transaction so a
// crash between the two steps can never award points that never land in
// the user's balance (or vice versa).
export async function completeTripAndAwardPoints(tripId: string, userId: string, input: CompleteTripInput): Promise<Trip> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<TripRow>(
      `UPDATE trips SET status = $1, verification_status = $2, points_awarded = $3, gps_trace = $4,
              actual_distance_meters = $5, actual_duration_seconds = $6,
              scoring_distance_meters = $7, co2_saved_grams = $8, ended_at = now()
       WHERE id = $9 AND status = 'in_progress' RETURNING ${SELECT_COLUMNS}`,
      [
        input.status,
        input.verificationStatus,
        input.pointsAwarded,
        JSON.stringify(input.gpsTrace),
        input.actualDistanceMeters,
        input.actualDurationSeconds,
        input.scoringDistanceMeters,
        input.co2SavedGrams,
        tripId,
      ]
    );
    // The `status = 'in_progress'` guard is what actually makes double-completion
    // safe: the check in the route handler is a separate read, so two concurrent
    // completions can both pass it. Here the second matches no row and rolls back
    // rather than crediting points twice.
    if (rows.length === 0) throw new Error('trip_not_in_progress');
    if (input.pointsAwarded > 0) {
      await client.query('UPDATE users SET points_balance = points_balance + $1, updated_at = now() WHERE id = $2', [
        input.pointsAwarded,
        userId,
      ]);
    }
    await client.query('COMMIT');
    return toTrip(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
