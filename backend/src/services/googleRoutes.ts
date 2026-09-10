// Off-campus car/motorcycle routing — see idea/2026-09-10-routefinder-design.md
// ("Traffic-aware routing") for why this is split out from our own graph.

const FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

const GOOGLE_TRAVEL_MODE = {
  car: 'DRIVE',
  motorcycle: 'TWO_WHEELER',
} as const;

export interface GoogleRouteResult {
  distanceMeters: number;
  seconds: number;
  polyline: string;
}

export async function computeGoogleRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: 'car' | 'motorcycle'
): Promise<GoogleRouteResult> {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_ROUTES_API_KEY is not configured');
  }

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
      travelMode: GOOGLE_TRAVEL_MODE[mode],
      routingPreference: 'TRAFFIC_AWARE',
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Routes API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
  };
  const route = data.routes?.[0];
  if (!route) {
    throw new Error('No route returned by Google Routes API');
  }

  return {
    distanceMeters: route.distanceMeters ?? 0,
    seconds: parseFloat(String(route.duration).replace('s', '')) || 0,
    polyline: route.polyline?.encodedPolyline ?? '',
  };
}
