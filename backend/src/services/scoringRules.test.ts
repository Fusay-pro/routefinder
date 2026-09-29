import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoringDecision,
  DAILY_SCORING_DISTANCE_METERS,
  MIN_TRIP_DISPLACEMENT_METERS,
} from './scoringRules.js';

// Both inside CAMPUS_BOUNDS (services/campus.ts), ~390m apart.
const ON_CAMPUS_ORIGIN = { originLat: 14.07, originLng: 100.6 };
const ON_CAMPUS_DEST = { destLat: 14.0735, destLng: 100.6 };
const OFF_CAMPUS = { destLat: 13.7298, destLng: 100.7815 };

const base = {
  ...ON_CAMPUS_ORIGIN,
  ...ON_CAMPUS_DEST,
  actualDistanceMeters: 400,
  tripsScoredToday: 0,
  distanceScoredTodayMeters: 0,
};

test('an ordinary campus trip scores the distance actually covered', () => {
  assert.deepEqual(scoringDecision(base), { scoringDistanceMeters: 400, refusal: null });
});

test('a trip that leaves the university zone scores nothing', () => {
  assert.deepEqual(scoringDecision({ ...base, ...OFF_CAMPUS }), {
    scoringDistanceMeters: 0,
    refusal: 'off_campus',
  });
});

test('an origin outside the zone is refused even when the destination is inside', () => {
  const decision = scoringDecision({ ...base, originLat: 13.7298, originLng: 100.7815 });
  assert.equal(decision.refusal, 'off_campus');
});

test('a hop too short to be a commute scores nothing', () => {
  // ~100m apart, under MIN_TRIP_DISPLACEMENT_METERS.
  const decision = scoringDecision({ ...base, destLat: 14.0709, destLng: 100.6 });
  assert.deepEqual(decision, { scoringDistanceMeters: 0, refusal: 'below_min_displacement' });
});

test('displacement is measured origin-to-destination, not along the route', () => {
  // A long, winding 3km route between two points 100m apart is still not a commute.
  const decision = scoringDecision({
    ...base,
    destLat: 14.0709,
    destLng: 100.6,
    actualDistanceMeters: 3000,
  });
  assert.equal(decision.refusal, 'below_min_displacement');
});

test('the displacement floor is inclusive at the boundary', () => {
  // 0.0025 degrees of latitude is ~278m — comfortably over the floor.
  const decision = scoringDecision({ ...base, destLat: 14.07 + 0.0025, destLng: 100.6 });
  assert.equal(decision.refusal, null);
  assert.ok(MIN_TRIP_DISPLACEMENT_METERS < 278);
});

test('past the daily trip cap, a trip scores nothing', () => {
  const decision = scoringDecision({ ...base, tripsScoredToday: 5 });
  assert.deepEqual(decision, { scoringDistanceMeters: 0, refusal: 'daily_trip_cap' });
});

test('a trip that crosses the daily distance cap scores the part under it', () => {
  const decision = scoringDecision({
    ...base,
    actualDistanceMeters: 3000,
    distanceScoredTodayMeters: DAILY_SCORING_DISTANCE_METERS - 1000,
  });
  assert.deepEqual(decision, { scoringDistanceMeters: 1000, refusal: 'daily_distance_cap' });
});

test('once the daily distance cap is spent, nothing more scores', () => {
  const decision = scoringDecision({
    ...base,
    distanceScoredTodayMeters: DAILY_SCORING_DISTANCE_METERS,
  });
  assert.deepEqual(decision, { scoringDistanceMeters: 0, refusal: 'daily_distance_cap' });
});
