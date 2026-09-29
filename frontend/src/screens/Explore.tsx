import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { Place } from '../api/types';
import { useJourney, type Endpoint } from '../trip/JourneyContext';
import { MapView, CAMPUS_CENTER } from '../components/MapView';
import { co2, km, ordinal } from '../lib/format';
import { ArrowRightIcon, DotIcon, LeafIcon, LocateIcon, PinIcon, SearchIcon } from '../components/icons';

export function Explore() {
  const navigate = useNavigate();
  const { origin, destination, setOrigin, setDestination } = useJourney();

  // The landing screen leads with where you stand this week, so the reason to
  // walk somewhere is visible before you pick anywhere to walk to.
  const distance = useApi(() => api.myStanding({ metric: 'distance', activity: 'foot', window: 'week' }), []);
  const saved = useApi(() => api.myStanding({ metric: 'co2', activity: 'foot', window: 'week' }), []);

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

  return (
    <div className="relative h-full overflow-hidden bg-map">
      <MapView className="absolute inset-0 h-full w-full" origin={origin} destination={destination} />

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
          <span className="flex-grow" />
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 shadow-chip"
          >
            <LeafIcon size={15} className="text-primary-fixed" />
            <span className="font-label text-[13px] font-bold text-white">
              {saved.data ? co2(saved.data.value) : '—'}
            </span>
          </button>
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
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-lowest p-3.5 text-left"
          >
            <div className="flex-grow">
              <p className="font-label text-[11px] font-bold uppercase tracking-wider text-outline">
                On foot this week
              </p>
              <p className="text-lg font-extrabold tabular-nums text-on-surface">
                {distance.data ? km(distance.data.value) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-label text-[11px] text-outline">
                {distance.data &&
                  (distance.data.rank === null
                    ? 'Unranked'
                    : `${ordinal(distance.data.rank)} of ${distance.data.totalRanked}`)}
              </p>
              <p className="font-label text-xs font-bold text-on-primary-container">
                {saved.data ? `${co2(saved.data.value)} saved` : ''}
              </p>
            </div>
          </button>

          <button
            disabled={!destination}
            onClick={() => navigate('/routes')}
            className="mb-1 flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-primary-container text-base font-bold text-on-primary-container disabled:bg-surface-highest disabled:text-outline"
          >
            {destination ? 'Go' : 'Pick a destination'}
            {destination && <ArrowRightIcon size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
