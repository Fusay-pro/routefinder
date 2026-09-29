// Current conditions for the campus, used to tell someone whether it's a good
// moment to walk or bike. Google Weather API (same Cloud project as the Routes
// key) — see idea/2026-09-10-routefinder-design.md for why we lean on Google
// for anything needing live data.

const CACHE_TTL_MS = 10 * 60 * 1000;
const COORD_PRECISION = 3; // ~110m — finer than this just fragments the cache

export interface BikeConditions {
  isBikeFriendly: boolean;
  advice: string;
}

export interface CurrentWeather extends BikeConditions {
  temperatureC: number;
  condition: string;
  description: string;
}

interface CacheEntry {
  value: CurrentWeather;
  expiresAt: number;
}

// Per-instance cache. Instances are stateless and this is read-only decorative
// data, so it's fine that two instances can hold slightly different snapshots.
const cache = new Map<string, CacheEntry>();

const TOO_HOT_C = 35;
const TOO_COLD_C = 10;
const HIGH_WIND_KPH = 30;
const LIKELY_RAIN_PERCENT = 50;

export function assessBikeConditions(input: {
  temperatureC: number;
  precipitationProbability: number;
  windKph: number;
}): BikeConditions {
  const { temperatureC, precipitationProbability, windKph } = input;

  if (precipitationProbability >= LIKELY_RAIN_PERCENT) {
    return { isBikeFriendly: false, advice: 'Rain likely — you may want cover' };
  }
  if (temperatureC >= TOO_HOT_C) {
    return { isBikeFriendly: false, advice: 'Very hot — take it slow and bring water' };
  }
  if (temperatureC <= TOO_COLD_C) {
    return { isBikeFriendly: false, advice: 'Cold out — dress warm' };
  }
  if (windKph >= HIGH_WIND_KPH) {
    return { isBikeFriendly: false, advice: 'Strong wind — tough going by bike' };
  }
  return { isBikeFriendly: true, advice: 'Great for walking or biking' };
}

interface GoogleCurrentConditions {
  weatherCondition?: { description?: { text?: string }; type?: string };
  temperature?: { degrees?: number };
  precipitation?: { probability?: { percent?: number } };
  wind?: { speed?: { value?: number } };
}

export async function getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_WEATHER_API_KEY is not configured');
  }

  const cacheKey = `${lat.toFixed(COORD_PRECISION)},${lng.toFixed(COORD_PRECISION)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('unitsSystem', 'METRIC');

  const response = await fetch(url);
  if (!response.ok) {
    // Logged, not returned: the upstream body can echo request details back and
    // this error text reaches the client.
    console.error(`Google Weather API error: ${response.status} ${await response.text()}`);
    throw new Error('Weather lookup failed');
  }

  const data = (await response.json()) as GoogleCurrentConditions;
  const temperatureC = data.temperature?.degrees ?? 0;
  const precipitationProbability = data.precipitation?.probability?.percent ?? 0;
  const windKph = data.wind?.speed?.value ?? 0;

  const value: CurrentWeather = {
    temperatureC,
    condition: data.weatherCondition?.type ?? 'UNKNOWN',
    description: data.weatherCondition?.description?.text ?? 'Unknown conditions',
    ...assessBikeConditions({ temperatureC, precipitationProbability, windKph }),
  };

  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
