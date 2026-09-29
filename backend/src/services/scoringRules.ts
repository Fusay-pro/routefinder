import { haversineMeters } from '../graph/geo.js';
import { isWithinCampus } from './campus.js';
import { DAILY_REWARD_TRIP_CAP } from './rewardsService.js';

// A trip has to actually go somewhere. Below this straight-line separation
// between origin and destination there's nothing to award — it stops someone
// repeating a 40m hop between two doors to climb a board.
export const MIN_TRIP_DISPLACEMENT_METERS = 250;

// The trip-count cap alone doesn't bound distance: five 30km trips a day is
// still not a commute. Distance past this in a day still gets recorded, it
// just stops counting toward points and the boards.
export const DAILY_SCORING_DISTANCE_METERS = 15_000;

export type ScoringRefusal =
  | 'off_campus'
  | 'below_min_displacement'
  | 'daily_trip_cap'
  | 'daily_distance_cap';

export interface ScoringInput {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  /** Distance actually covered, derived from the GPS trace — not the planned route. */
  actualDistanceMeters: number;
  /** Verified, point-earning trips the user has already completed today. */
  tripsScoredToday: number;
  /** Distance already counted toward today's boards, in meters. */
  distanceScoredTodayMeters: number;
}

export interface ScoringDecision {
  /** How much of this trip counts toward points and the leaderboards. */
  scoringDistanceMeters: number;
  /** Why it was reduced or zeroed, for the client to explain to the user. */
  refusal: ScoringRefusal | null;
}

// Decides how much of a *verified* trip actually scores. Verification (does
// this trace look real?) is tripVerification.ts's job and runs first; this
// answers the separate question of whether a real trip is the kind of trip
// the competition is meant to reward.
export function scoringDecision(input: ScoringInput): ScoringDecision {
  const refused = (refusal: ScoringRefusal): ScoringDecision => ({ scoringDistanceMeters: 0, refusal });

  // The zone is the university. Both ends have to be inside it.
  if (!isWithinCampus(input.originLat, input.originLng) || !isWithinCampus(input.destLat, input.destLng)) {
    return refused('off_campus');
  }

  const displacement = haversineMeters(input.originLat, input.originLng, input.destLat, input.destLng);
  if (displacement < MIN_TRIP_DISPLACEMENT_METERS) return refused('below_min_displacement');

  if (input.tripsScoredToday >= DAILY_REWARD_TRIP_CAP) return refused('daily_trip_cap');

  const remainingToday = DAILY_SCORING_DISTANCE_METERS - input.distanceScoredTodayMeters;
  if (remainingToday <= 0) return refused('daily_distance_cap');

  // Partially over the cap: the part under it still counts, rather than losing
  // the whole trip for going long once.
  if (input.actualDistanceMeters > remainingToday) {
    return { scoringDistanceMeters: remainingToday, refusal: 'daily_distance_cap' };
  }

  return { scoringDistanceMeters: input.actualDistanceMeters, refusal: null };
}
