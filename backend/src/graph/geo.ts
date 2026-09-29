export interface ElevationDelta {
  gainMeters: number;
  lossMeters: number;
}

// Total climb and total descent along a path, reported separately: a flat-ish
// route and a route that goes up 30m then back down net out the same, but they
// are not the same ride. Returns zeroes when the graph carries no elevation.
export function elevationDelta(points: { elevationMeters?: number }[]): ElevationDelta {
  let gainMeters = 0;
  let lossMeters = 0;

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1].elevationMeters;
    const current = points[i].elevationMeters;
    if (previous === undefined || current === undefined) continue;

    const step = current - previous;
    if (step > 0) gainMeters += step;
    else lossMeters -= step;
  }

  return { gainMeters: Math.round(gainMeters), lossMeters: Math.round(lossMeters) };
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
