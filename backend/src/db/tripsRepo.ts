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
  started_at: string;
  ended_at: string | null;
}

const SELECT_COLUMNS = `id, user_id, travel_mode, origin_place_id, origin_lat, origin_lng,
  destination_place_id, destination_lat, destination_lng, suggested_route, distance_meters,
  estimated_seconds, gps_trace, status, verification_status, points_awarded, started_at, ended_at`;

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

export async function countVerifiedTripsToday(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM trips
     WHERE user_id = $1 AND verification_status = 'verified' AND started_at >= date_trunc('day', now())`,
    [userId]
  );
  return rows[0]?.count ?? 0;
}

export interface CompleteTripInput {
  status: TripStatus;
  verificationStatus: VerificationStatus;
  pointsAwarded: number;
  gpsTrace: unknown;
}

// Completing the trip and crediting points happen in one transaction so a
// crash between the two steps can never award points that never land in
// the user's balance (or vice versa).
export async function completeTripAndAwardPoints(tripId: string, userId: string, input: CompleteTripInput): Promise<Trip> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<TripRow>(
      `UPDATE trips SET status = $1, verification_status = $2, points_awarded = $3, gps_trace = $4, ended_at = now()
       WHERE id = $5 RETURNING ${SELECT_COLUMNS}`,
      [input.status, input.verificationStatus, input.pointsAwarded, JSON.stringify(input.gpsTrace), tripId]
    );
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
