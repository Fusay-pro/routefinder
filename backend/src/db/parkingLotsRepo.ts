import { pool } from './pool.js';
import type { ParkingSpot, ParkingStatus } from './parkingSpotsRepo.js';

// A sensor that stops reporting leaves its spot's last_updated frozen forever.
// Harmless when displaying one spot; it silently inflates a free-spot count, so
// anything past this window is folded into `unknown` rather than trusted.
const SENSOR_STALE_AFTER = '15 minutes';

export interface ParkingLot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  permitTier: string | null;
}

export interface ParkingLotSummary extends ParkingLot {
  totalSpots: number;
  freeSpots: number;
  occupiedSpots: number;
  unknownSpots: number;
  lastUpdated: string | null;
}

interface ParkingLotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  permit_tier: string | null;
}

interface ParkingLotSummaryRow extends ParkingLotRow {
  total_spots: number;
  free_spots: number;
  occupied_spots: number;
  last_updated: string | null;
}

function toParkingLot(row: ParkingLotRow): ParkingLot {
  return { id: row.id, name: row.name, lat: row.lat, lng: row.lng, permitTier: row.permit_tier };
}

function toParkingLotSummary(row: ParkingLotSummaryRow): ParkingLotSummary {
  return {
    ...toParkingLot(row),
    totalSpots: row.total_spots,
    freeSpots: row.free_spots,
    occupiedSpots: row.occupied_spots,
    // Derived rather than counted so the three always sum to the total, whatever
    // the staleness window excluded.
    unknownSpots: row.total_spots - row.free_spots - row.occupied_spots,
    lastUpdated: row.last_updated,
  };
}

export async function listParkingLotsWithCounts(): Promise<ParkingLotSummary[]> {
  const { rows } = await pool.query<ParkingLotSummaryRow>(
    `SELECT l.id, l.name, l.lat, l.lng, l.permit_tier,
            count(s.id)::int AS total_spots,
            count(*) FILTER (WHERE s.status = 'free' AND s.last_updated > now() - $1::interval)::int AS free_spots,
            count(*) FILTER (WHERE s.status = 'occupied' AND s.last_updated > now() - $1::interval)::int AS occupied_spots,
            max(s.last_updated) AS last_updated
     FROM parking_lots l
     LEFT JOIN parking_spots s ON s.lot_id = l.id
     GROUP BY l.id
     ORDER BY l.name`,
    [SENSOR_STALE_AFTER]
  );
  return rows.map(toParkingLotSummary);
}

export async function findParkingLotById(id: string): Promise<ParkingLot | null> {
  const { rows } = await pool.query<ParkingLotRow>(
    'SELECT id, name, lat, lng, permit_tier FROM parking_lots WHERE id = $1',
    [id]
  );
  return rows[0] ? toParkingLot(rows[0]) : null;
}

export interface CreateParkingLotInput {
  name: string;
  lat: number;
  lng: number;
  permitTier: string | null;
}

export async function createParkingLot(input: CreateParkingLotInput): Promise<ParkingLot> {
  const { rows } = await pool.query<ParkingLotRow>(
    `INSERT INTO parking_lots (name, lat, lng, permit_tier) VALUES ($1, $2, $3, $4)
     RETURNING id, name, lat, lng, permit_tier`,
    [input.name, input.lat, input.lng, input.permitTier]
  );
  return toParkingLot(rows[0]);
}

interface SpotWithLevelRow {
  id: string;
  label: string;
  level: string | null;
  lat: number;
  lng: number;
  status: ParkingStatus;
  last_updated: string;
}

export interface ParkingSpotWithLevel extends ParkingSpot {
  level: string | null;
}

function toSpotWithLevel(row: SpotWithLevelRow): ParkingSpotWithLevel {
  return {
    id: row.id,
    label: row.label,
    level: row.level,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    lastUpdated: row.last_updated,
  };
}

export async function listSpotsForLot(lotId: string): Promise<ParkingSpotWithLevel[]> {
  const { rows } = await pool.query<SpotWithLevelRow>(
    `SELECT id, label, level, lat, lng, status, last_updated
     FROM parking_spots WHERE lot_id = $1 ORDER BY level NULLS FIRST, label`,
    [lotId]
  );
  return rows.map(toSpotWithLevel);
}

export interface CreateParkingSpotInput {
  lotId: string | null;
  label: string;
  level: string | null;
  lat: number;
  lng: number;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpotWithLevel> {
  const { rows } = await pool.query<SpotWithLevelRow>(
    `INSERT INTO parking_spots (lot_id, label, level, lat, lng) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, level, lat, lng, status, last_updated`,
    [input.lotId, input.label, input.level, input.lat, input.lng]
  );
  return toSpotWithLevel(rows[0]);
}
