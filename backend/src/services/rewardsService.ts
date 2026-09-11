import type { Mode } from '../graph/types.js';

// Flat rate by mode and distance, per the design spec. Motorcycle/car earn
// nothing — rewards exist to nudge people toward walking/biking.
const POINTS_PER_KM: Record<Mode, number> = {
  walk: 10,
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
