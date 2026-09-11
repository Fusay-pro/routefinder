import { pool } from './pool.js';

export interface Place {
  id: string;
  canonicalName: string;
  lat: number;
  lng: number;
  aliases: string[];
}

interface PlaceRow {
  id: string;
  canonical_name: string;
  lat: number;
  lng: number;
  aliases: string[] | null;
}

export async function searchPlaces(query: string, limit = 20): Promise<Place[]> {
  const { rows } = await pool.query<PlaceRow>(
    `SELECT p.id, p.canonical_name, p.lat, p.lng,
            array_remove(array_agg(DISTINCT a.alias), NULL) AS aliases
     FROM places p
     LEFT JOIN place_aliases a ON a.place_id = p.id
     WHERE p.canonical_name ILIKE '%' || $1 || '%'
        OR EXISTS (SELECT 1 FROM place_aliases a2 WHERE a2.place_id = p.id AND a2.alias ILIKE '%' || $1 || '%')
     GROUP BY p.id
     ORDER BY p.canonical_name
     LIMIT $2`,
    [query, limit]
  );
  return rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonical_name,
    lat: row.lat,
    lng: row.lng,
    aliases: row.aliases ?? [],
  }));
}

export interface CreatePlaceInput {
  canonicalName: string;
  lat: number;
  lng: number;
}

export async function createPlace(input: CreatePlaceInput): Promise<Place> {
  const { rows } = await pool.query<{ id: string; canonical_name: string; lat: number; lng: number }>(
    'INSERT INTO places (canonical_name, lat, lng) VALUES ($1, $2, $3) RETURNING id, canonical_name, lat, lng',
    [input.canonicalName, input.lat, input.lng]
  );
  const row = rows[0];
  return { id: row.id, canonicalName: row.canonical_name, lat: row.lat, lng: row.lng, aliases: [] };
}

export async function addPlaceAlias(placeId: string, alias: string, createdBy: string): Promise<void> {
  await pool.query(
    'INSERT INTO place_aliases (place_id, alias, created_by) VALUES ($1, $2, $3) ON CONFLICT (place_id, alias) DO NOTHING',
    [placeId, alias, createdBy]
  );
}
