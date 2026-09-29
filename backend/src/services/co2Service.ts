import type { Mode } from '../graph/types.js';

// Grams of CO2e per kilometre for the trip that didn't happen: one average car.
//
// 170 is a defensible mid-range figure for a whole-fleet average car, but it is
// a chosen number, not a measured one, and three judgements are baked into it:
//
//  - Tailpipe only. Counting fuel production and refining (well-to-wheel) would
//    add roughly a fifth.
//  - Per vehicle, not per passenger. Average car occupancy is above one, so the
//    per-passenger figure would be lower.
//  - It assumes the trip would otherwise have been made by car at all. For a
//    student walking to a lecture that is often untrue, which makes this an
//    upper bound on what was really avoided rather than a measurement.
//
// Credible alternatives span roughly 110 (EU new-car average) to 250 (US
// average passenger vehicle). Thailand's fleet carries a large share of pickup
// trucks, which would push a locally-sourced figure upward.
//
// Deliberately one constant in one place: if it's ever challenged, it should be
// a single edit against a citable source — Thailand's TGO publishes national
// emission factors — rather than a hunt through the codebase.
export const CAR_GRAMS_PER_KM = 170;

// Which modes count as having avoided a car trip. Motorcycle and car save
// nothing rather than something: a motorcycle does emit less than a car, but a
// board that pays people to ride motorcycles defeats the purpose, and a
// negative score would let a driver drag their faculty down by logging trips
// honestly — which is a perverse thing to punish.
const AVOIDS_CAR_TRIP: Record<Mode, boolean> = {
  walk: true,
  run: true,
  bike: true,
  motorcycle: false,
  car: false,
};

export function co2SavedGrams(mode: Mode, distanceMeters: number): number {
  if (!AVOIDS_CAR_TRIP[mode] || distanceMeters <= 0) return 0;
  return Math.round((distanceMeters / 1000) * CAR_GRAMS_PER_KM);
}
