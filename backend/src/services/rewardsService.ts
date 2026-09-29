import type { Mode } from '../graph/types.js';

// Flat rate by mode and distance. Motorcycle/car earn nothing — the app exists
// to move trips off them. Running pays more than walking over the same ground
// because it's the same distance for more effort.
const POINTS_PER_KM: Record<Mode, number> = {
  walk: 10,
  run: 12,
  bike: 5,
  motorcycle: 0,
  car: 0,
};

export function calculatePoints(mode: Mode, distanceMeters: number): number {
  return Math.round((distanceMeters / 1000) * POINTS_PER_KM[mode]);
}

// Bounds reward-farming: once a user has this many verified trips today,
// further trips can still complete/verify, they just stop earning points.
export const DAILY_REWARD_TRIP_CAP = 5;
