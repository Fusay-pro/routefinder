import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTrip, traceDistanceMeters, type GpsPoint, type RoutePoint } from './tripVerification.js';

const ROUTE: RoutePoint[] = [
  { lat: 13.73, lng: 100.78 },
  { lat: 13.7305, lng: 100.781 },
  { lat: 13.7298, lng: 100.7815 },
];

function walkAt(lat: number, lng: number, secondsFromStart: number): GpsPoint {
  return { lat, lng, t: new Date(Date.UTC(2026, 0, 1, 0, 0, secondsFromStart)).toISOString() };
}

test('verifies a trace that follows the route at a plausible walking pace', () => {
  const distance = traceDistanceMeters([
    { lat: 13.73, lng: 100.78, t: '' },
    { lat: 13.7305, lng: 100.781, t: '' },
    { lat: 13.7298, lng: 100.7815, t: '' },
  ]);
  const durationSeconds = (distance / 1000 / 4) * 3600; // ~4 km/h, well within the walk range

  const trace: GpsPoint[] = [
    walkAt(13.73, 100.78, 0),
    walkAt(13.7305, 100.781, durationSeconds / 2),
    walkAt(13.7298, 100.7815, durationSeconds),
  ];

  const outcome = verifyTrip(trace, ROUTE, 'walk', distance, durationSeconds);
  assert.equal(outcome, 'verified');
});

test('rejects a trace that strays far from the suggested route', () => {
  const trace: GpsPoint[] = [
    walkAt(13.73, 100.78, 0),
    walkAt(14.0, 101.0, 300), // nowhere near the route
    walkAt(13.7298, 100.7815, 600),
  ];

  const outcome = verifyTrip(trace, ROUTE, 'walk', 500, 600);
  assert.equal(outcome, 'rejected');
});

test('rejects a trace that implies an impossible speed for the claimed mode', () => {
  const trace: GpsPoint[] = [walkAt(13.73, 100.78, 0), walkAt(13.7305, 100.781, 1)]; // ~65m in 1s

  const distance = traceDistanceMeters(trace);
  const outcome = verifyTrip(trace, ROUTE, 'walk', distance, 1);
  assert.equal(outcome, 'rejected');
});

test('flags a suspiciously uniform trace for manual review instead of auto-rejecting', () => {
  // Perfectly identical step spacing — no GPS jitter at all.
  const trace: GpsPoint[] = [
    walkAt(13.73, 100.78, 0),
    walkAt(13.73009, 100.78, 10),
    walkAt(13.73018, 100.78, 20),
    walkAt(13.73027, 100.78, 30),
    walkAt(13.73036, 100.78, 40),
    walkAt(13.73045, 100.78, 50),
  ];
  const distance = traceDistanceMeters(trace);
  const route: RoutePoint[] = trace.map((p) => ({ lat: p.lat, lng: p.lng }));

  const outcome = verifyTrip(trace, route, 'walk', distance, 50);
  assert.equal(outcome, 'flagged_review');
});

test('verifies a trace walking the straight line of a sparse two-node route, including the midpoint', () => {
  // Regression test: a route with only two nodes (start/end of one long edge)
  // should still count a trace point exactly halfway along it as on-route.
  // An earlier version of pathAdherenceRatio only measured distance to route
  // *nodes*, so this midpoint looked ~60m off-route and got rejected.
  const sparseRoute: RoutePoint[] = [
    { lat: 13.73, lng: 100.78 },
    { lat: 13.7305, lng: 100.781 },
  ];

  const distance = traceDistanceMeters([
    { lat: 13.73, lng: 100.78, t: '' },
    { lat: 13.73025, lng: 100.7805, t: '' },
    { lat: 13.7305, lng: 100.781, t: '' },
  ]);
  const durationSeconds = (distance / 1000 / 4) * 3600; // ~4 km/h

  const trace: GpsPoint[] = [
    walkAt(13.73, 100.78, 0),
    walkAt(13.73025, 100.7805, durationSeconds / 2), // the midpoint of the edge
    walkAt(13.7305, 100.781, durationSeconds),
  ];

  const outcome = verifyTrip(trace, sparseRoute, 'walk', distance, durationSeconds);
  assert.equal(outcome, 'verified');
});

test('returns unverified for a trace too short to judge', () => {
  const outcome = verifyTrip([walkAt(13.73, 100.78, 0)], ROUTE, 'walk', 0, 0);
  assert.equal(outcome, 'unverified');
});
