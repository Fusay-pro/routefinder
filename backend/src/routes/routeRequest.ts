import type { Mode } from '../graph/types.js';

export const VALID_TRAVEL_MODES: Mode[] = ['walk', 'bike', 'motorcycle', 'car'];

export interface RouteRequestBody {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  travelMode: Mode;
}

// Shared by /route and /trips — both start from the same origin/dest/mode shape.
export function parseRouteRequestBody(body: unknown): RouteRequestBody | null {
  const { originLat, originLng, destLat, destLng, travelMode } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof originLat !== 'number' ||
    typeof originLng !== 'number' ||
    typeof destLat !== 'number' ||
    typeof destLng !== 'number' ||
    !VALID_TRAVEL_MODES.includes(travelMode as Mode)
  ) {
    return null;
  }
  return { originLat, originLng, destLat, destLng, travelMode: travelMode as Mode };
}
