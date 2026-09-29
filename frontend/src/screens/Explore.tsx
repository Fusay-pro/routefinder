import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { Place } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useJourney, type Endpoint } from '../trip/JourneyContext';
import { MapView, CAMPUS_CENTER } from '../components/MapView';
import { ParkingLotCard } from '../components/ParkingLotCard';
import { WeatherPill } from '../components/WeatherPill';
import { ArrowRightIcon, CoinIcon, DotIcon, LocateIcon, PinIcon, SearchIcon } from '../components/icons';

export function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { origin, destination, setOrigin, setDestination } = useJourney();

  const lots = useApi(() => api.parkingLots(), []);
  // Weather is best-effort: a missing API key must not take the screen down.
  const weather = useApi(() => api.weather().catch(() => null), []);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!origin) {
      setOrigin({ name: 'Campus centre', lat: CAMPUS_CENTER.lat, lng: CAMPUS_CENTER.lng });
    }
  }, [origin, setOrigin]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchPlaces(trimmed)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(place: Place) {
    const endpoint: Endpoint = {
      name: place.canonicalName,
      lat: place.lat,
      lng: place.lng,
      placeId: place.id,
    };
    setDestination(endpoint);
    setQuery('');
    setResults([]);
  }

  const firstLot = lots.data?.[0];

  return (
    <div className="relative h-full overflow-hidden bg-map">
      <MapView
        className="absolute inset-0 h-full w-full"
        origin={origin}
        destination={destination}
        lots={lots.data ?? []}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3.5">
        <div className="pointer-events-auto flex flex-col gap-0.5 rounded-[18px] bg-surface-lowest p-3 shadow-float">
          <div className="flex h-[38px] items-center gap-2.5">
            <DotIcon size={17} className="text-secondary" />
            <span className="flex-grow truncate text-sm font-semibold text-on-surface-variant">
              {origin?.name ?? 'Locating…'}
            </span>
          </div>
          <div className="ml-[27px] h-px bg-surface-c" />
          <div className="flex h-[38px] items-center gap-2.5">
            <PinIcon size={17} className="text-primary" />
            <input
              value={destination && !query ? destination.name : query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (destination) setDestination(null);
              }}
              placeholder="Search a building or nickname"
              className="w-full flex-grow bg-transparent text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-outline"
            />
            {searching && <SearchIcon size={16} className="text-outline" />}
          </div>

          {results.length > 0 && (
            <div className="mt-1 flex flex-col border-t border-surface-c pt-1">
              {results.slice(0, 4).map((place) => (
                <button
                  key={place.id}
                  onClick={() => pick(place)}
                  className="flex flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-surface-low"
                >
                  <span className="text-sm font-semibold">{place.canonicalName}</span>
                  {place.aliases.length > 0 && (
                    <span className="font-label text-[11px] text-on-surface-variant">
                      {place.aliases.join(' · ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="pointer-events-auto">
            <WeatherPill weather={weather.data ?? null} />
          </div>
          <span className="flex-grow" />
          <div className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 shadow-chip">
            <CoinIcon size={15} className="text-primary-fixed" />
            <span className="font-label text-[13px] font-bold text-white">
              {user?.pointsBalance ?? 0}
            </span>
          </div>
        </div>
      </div>

      <button className="absolute right-3.5 top-[300px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-surface-lowest text-primary shadow-float">
        <LocateIcon size={21} />
      </button>

      <div className="absolute inset-x-0 bottom-0 rounded-t-[22px] bg-surface-lowest shadow-sheet">
        <div className="flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-surface-highest" />
        </div>

        <div className="flex flex-col gap-3 px-4 pt-3">
          {lots.loading && <p className="font-label text-xs text-outline">Loading parking…</p>}
          {lots.error && (
            <p className="font-label text-xs text-on-error-container">Parking unavailable</p>
          )}
          {firstLot && <ParkingLotCard lot={firstLot} />}
          {lots.data?.length === 0 && (
            <p className="font-label text-xs text-outline">No parking lots configured yet.</p>
          )}

          <button
            disabled={!destination}
            onClick={() => navigate('/routes')}
            className="flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-primary-container text-base font-bold text-on-primary-container disabled:bg-surface-highest disabled:text-outline"
          >
            {destination ? 'Get directions' : 'Pick a destination'}
            {destination && <ArrowRightIcon size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
