import type {
  AuthResult,
  CatalogItem,
  CurrentWeather,
  GpsPoint,
  Mode,
  ParkingLotSummary,
  ParkingSpot,
  Place,
  Redemption,
  RouteResult,
  Trip,
  User,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'routefinder.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the session just won't persist across reloads */
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  signup: (email: string, password: string, displayName?: string) =>
    post<AuthResult>('/auth/signup', { email, password, displayName }),
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  me: () => request<User>('/auth/me'),

  searchPlaces: (q: string) => request<Place[]>(`/places/search?q=${encodeURIComponent(q)}`),

  route: (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, travelMode: Mode) =>
    post<RouteResult>('/route', {
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: dest.lat,
      destLng: dest.lng,
      travelMode,
    }),

  startTrip: (body: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    travelMode: Mode;
    originPlaceId?: string | null;
    destinationPlaceId?: string | null;
  }) => post<Trip>('/trips', body),
  completeTrip: (id: string, gpsTrace: GpsPoint[]) => post<Trip>(`/trips/${id}/complete`, { gpsTrace }),
  trips: () => request<Trip[]>('/trips'),

  parkingLots: () => request<ParkingLotSummary[]>('/parking-lots'),
  lotSpots: (id: string) =>
    request<{ lot: ParkingLotSummary; spots: ParkingSpot[] }>(`/parking-lots/${id}/spots`),

  weather: () => request<CurrentWeather>('/weather'),

  catalog: () => request<CatalogItem[]>('/redemptions/catalog'),
  redeem: (catalogItemId: string) =>
    post<{ redemption: Redemption; pointsBalance: number }>('/redemptions', { catalogItemId }),
  redemptions: () => request<Redemption[]>('/redemptions'),
};
