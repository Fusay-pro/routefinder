import { haversineMeters } from '../graph/geo.js';
import type { Mode } from '../graph/types.js';

export interface GpsPoint {
  lat: number;
  lng: number;
  t: string; // ISO timestamp
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

const ADHERENCE_RADIUS_METERS = 25;
const ADHERENCE_MIN_RATIO = 0.8; // "most" of the trace must stay near the suggested route

const SPEED_RANGE_KMH: Record<Mode, [number, number]> = {
  walk: [2, 7],
  bike: [5, 25],
  motorcycle: [10, 80],
  car: [5, 100],
};

// A trace this uniform in its step lengths doesn't look like a real walk/bike
// ride (GPS jitter is expected) — flag for manual review rather than reject.
const SMOOTHNESS_MIN_STEP_COUNT = 4;
const SMOOTHNESS_MIN_COEFFICIENT_OF_VARIATION = 0.05;

export function traceDistanceMeters(trace: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < trace.length; i++) {
    total += haversineMeters(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng);
  }
  return total;
}

export function traceDurationSeconds(trace: GpsPoint[]): number {
  if (trace.length < 2) return 0;
  const start = new Date(trace[0].t).getTime();
  const end = new Date(trace[trace.length - 1].t).getTime();
  return Math.max(0, (end - start) / 1000);
}

// Distance from a point to a route segment, via a local flat-plane projection
// centered on the segment's start. Accurate enough at campus/city scale (the
// curvature error over a few hundred meters is negligible) and much cheaper
// than doing the projection in true spherical coordinates.
function distanceToSegmentMeters(point: RoutePoint, segStart: RoutePoint, segEnd: RoutePoint): number {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((segStart.lat * Math.PI) / 180);

  const toLocal = (p: RoutePoint) => ({
    x: (p.lng - segStart.lng) * metersPerDegLng,
    y: (p.lat - segStart.lat) * metersPerDegLat,
  });

  const p = toLocal(point);
  const e = toLocal(segEnd);

  const segLengthSquared = e.x * e.x + e.y * e.y;
  const t = segLengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (p.x * e.x + p.y * e.y) / segLengthSquared));

  return Math.hypot(p.x - t * e.x, p.y - t * e.y);
}

function nearestDistanceToRoute(point: RoutePoint, route: RoutePoint[]): number {
  if (route.length === 1) {
    return haversineMeters(point.lat, point.lng, route[0].lat, route[0].lng);
  }
  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const d = distanceToSegmentMeters(point, route[i - 1], route[i]);
    if (d < best) best = d;
  }
  return best;
}

// Distance to the nearest point on the route *line*, not just its nodes —
// otherwise a trace walking the straight line between two sparse nodes would
// look like it strayed off-route in the middle, even while exactly on it.
export function pathAdherenceRatio(trace: GpsPoint[], route: RoutePoint[]): number {
  if (trace.length === 0 || route.length === 0) return 0;
  const withinRadius = trace.filter((p) => nearestDistanceToRoute(p, route) <= ADHERENCE_RADIUS_METERS).length;
  return withinRadius / trace.length;
}

export function isSpeedPlausible(mode: Mode, distanceMeters: number, durationSeconds: number): boolean {
  if (durationSeconds <= 0) return false;
  const kmh = distanceMeters / 1000 / (durationSeconds / 3600);
  const [min, max] = SPEED_RANGE_KMH[mode];
  return kmh >= min && kmh <= max;
}

export function isTraceSuspiciouslySmooth(trace: GpsPoint[]): boolean {
  if (trace.length < SMOOTHNESS_MIN_STEP_COUNT + 1) return false;
  const steps: number[] = [];
  for (let i = 1; i < trace.length; i++) {
    steps.push(haversineMeters(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng));
  }
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  if (mean === 0) return true; // zero movement across every fix is its own red flag
  const variance = steps.reduce((sum, s) => sum + (s - mean) ** 2, 0) / steps.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return coefficientOfVariation < SMOOTHNESS_MIN_COEFFICIENT_OF_VARIATION;
}

export type VerificationOutcome = 'verified' | 'flagged_review' | 'rejected' | 'unverified';

export function verifyTrip(
  trace: GpsPoint[],
  route: RoutePoint[] | null,
  mode: Mode,
  distanceMeters: number,
  durationSeconds: number
): VerificationOutcome {
  if (trace.length < 2) return 'unverified';
  if (route && pathAdherenceRatio(trace, route) < ADHERENCE_MIN_RATIO) return 'rejected';
  if (!isSpeedPlausible(mode, distanceMeters, durationSeconds)) return 'rejected';
  if (isTraceSuspiciouslySmooth(trace)) return 'flagged_review';
  return 'verified';
}
