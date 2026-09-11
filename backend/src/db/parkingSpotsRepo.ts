import { pool } from './pool.js';

export type ParkingStatus = 'free' | 'occupied' | 'unknown';

export interface ParkingSpot {
  id: string;
  label: string;
  lat: number;
  lng: number;
  status: ParkingStatus;
  lastUpdated: string;
}

function toParkingSpot(row: {
  id: string;
  label: string;
  lat: number;
  lng: number;
  status: ParkingStatus;
  last_updated: string;
}): ParkingSpot {
  return {
    id: row.id,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    status: row.status,
    lastUpdated: row.last_updated,
  };
}

export async function listParkingSpots(): Promise<ParkingSpot[]> {
  const { rows } = await pool.query('SELECT id, label, lat, lng, status, last_updated FROM parking_spots ORDER BY label');
  return rows.map(toParkingSpot);
}

export async function updateParkingSpotStatus(id: string, status: ParkingStatus): Promise<ParkingSpot | null> {
  const { rows } = await pool.query(
    'UPDATE parking_spots SET status = $1, last_updated = now() WHERE id = $2 RETURNING id, label, lat, lng, status, last_updated',
    [status, id]
  );
  return rows[0] ? toParkingSpot(rows[0]) : null;
}
