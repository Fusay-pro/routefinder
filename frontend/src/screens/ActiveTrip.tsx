import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { GpsPoint, LatLng, Mode } from '../api/types';
import { useJourney } from '../trip/JourneyContext';
import { MapView } from '../components/MapView';
import { haversineMeters, routeGeometry, traceDistanceMeters } from '../lib/polyline';
import { clock, km, paceKmh } from '../lib/format';
import { CoinIcon, LocateIcon, MODE_ICON, StopIcon } from '../components/icons';

// Comfortably inside the backend's plausible-speed band for each mode
// (SPEED_RANGE_KMH in services/tripVerification.ts).
const SIM_SPEED_KMH: Record<Mode, number> = { walk: 4.8, run: 10, bike: 14, motorcycle: 40, car: 40 };

export function ActiveTrip() {
  const navigate = useNavigate();
  const { origin, destination, selection, activeTrip, setActiveTrip, setFinishedTrip } = useJourney();

  const [trace, setTrace] = useState<GpsPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const simTimer = useRef<number | null>(null);

  const route = selection?.route ?? null;
  const geometry = routeGeometry(route);

  // Start the trip server-side once, so completing it has a route to verify against.
  useEffect(() => {
    if (activeTrip || !origin || !destination || !selection) return;
    api
      .startTrip({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        travelMode: selection.mode,
        originPlaceId: origin.placeId ?? null,
        destinationPlaceId: destination.placeId ?? null,
      })
      .then(setActiveTrip)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not start trip'));
  }, [activeTrip, origin, destination, selection, setActiveTrip]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Real GPS. On a desktop this yields a single stationary fix, which is why the
  // simulator below exists for development.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) =>
        setTrace((prev) => [
          ...prev,
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            t: new Date().toISOString(),
          },
        ]),
      () => setError('Location permission denied — the trip will save unverified'),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => () => {
    if (simTimer.current) window.clearInterval(simTimer.current);
  }, []);

  function simulate() {
    if (simTimer.current || geometry.length < 2) return;

    // Timestamps have to come from each segment's real length, not a fixed tick:
    // the backend checks average speed against a per-mode range, so pacing every
    // point 6 s apart regardless of distance reads as ~19 km/h and gets rejected.
    const speedKmh = SIM_SPEED_KMH[selection!.mode];
    let index = 0;
    let simulatedMs = Date.now();
    setTrace([]);

    simTimer.current = window.setInterval(() => {
      if (index >= geometry.length) {
        if (simTimer.current) window.clearInterval(simTimer.current);
        simTimer.current = null;
        return;
      }
      const point = geometry[index];
      if (index > 0) {
        const segmentMeters = haversineMeters(geometry[index - 1], point);
        simulatedMs += (segmentMeters / ((speedKmh * 1000) / 3600)) * 1000;
      }
      index++;

      // A little jitter, so the track doesn't look machine-smooth and trip the
      // spoofing heuristic.
      const jitter = () => (Math.random() - 0.5) * 0.00004;
      const stamp = new Date(simulatedMs).toISOString();
      setTrace((prev) => [...prev, { lat: point.lat + jitter(), lng: point.lng + jitter(), t: stamp }]);
    }, 120);
  }

  async function end() {
    if (!activeTrip) return;
    setEnding(true);
    try {
      const finished = await api.completeTrip(activeTrip.id, trace);
      setFinishedTrip(finished);
      setActiveTrip(null);
      navigate('/complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish the trip');
      setEnding(false);
    }
  }

  if (!selection || !destination) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-label text-sm text-on-surface-variant">No trip in progress.</p>
        <button onClick={() => navigate('/')} className="font-label text-sm font-bold text-primary">
          Back to the map
        </button>
      </div>
    );
  }

  const travelled: LatLng[] = trace.map((p) => ({ lat: p.lat, lng: p.lng }));
  const distance = traceDistanceMeters(travelled);
  const target = route?.distanceMeters ?? 0;
  const ModeIcon = MODE_ICON[selection.mode];

  return (
    <div className="relative h-full overflow-hidden bg-map">
      <MapView
        className="absolute inset-0 h-full w-full"
        route={geometry}
        travelled={travelled}
        origin={origin}
        destination={destination}
        current={travelled.at(-1) ?? null}
      />

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3.5">
        <div className="flex h-[38px] items-center gap-2 rounded-full bg-primary px-3.5 shadow-chip">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-fixed" />
          <span className="font-label text-xs font-bold tracking-wider text-white">RECORDING</span>
        </div>
        <span className="flex-grow" />
        <div className="flex h-[38px] items-center gap-1.5 rounded-full bg-surface-lowest px-3.5 shadow-chip">
          <ModeIcon size={16} className="text-on-primary-container" />
          <span className="font-label text-xs font-bold capitalize">{selection.mode}</span>
        </div>
      </div>

      <button className="absolute right-3.5 top-[300px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-surface-lowest text-primary shadow-float">
        <LocateIcon size={21} />
      </button>

      <div className="absolute inset-x-0 bottom-0 rounded-t-[22px] bg-surface-lowest pb-5 shadow-sheet">
        <div className="flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-surface-highest" />
        </div>

        <div className="flex gap-2.5 px-4 pt-3.5">
          <Stat label="DISTANCE" value={(distance / 1000).toFixed(2)} sub={`of ${km(target)}`} />
          <div className="w-px bg-surface-c" />
          <Stat label="ELAPSED" value={clock(elapsed)} sub="min" />
          <div className="w-px bg-surface-c" />
          <Stat label="PACE" value={paceKmh(distance, elapsed)} sub="km/h" />
        </div>

        <div className="mx-4 mt-3.5 flex flex-col gap-2.5 rounded-2xl bg-success-container p-3.5">
          <div className="flex items-center gap-2">
            <CoinIcon size={17} className="text-primary" />
            <span className="flex-grow font-label text-[13px] font-bold text-on-primary-container">
              {route?.estimatedPoints ?? 0} points on the line
            </span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-surface-lowest">
            <div
              className="h-full rounded-full bg-primary-container transition-[width]"
              style={{ width: `${target ? Math.min(100, (distance / target) * 100) : 0}%` }}
            />
          </div>
          <span className="font-label text-[11px] font-medium text-on-surface-variant">
            Stay on the suggested route so the trip can verify
          </span>
        </div>

        {error && (
          <p className="mx-4 mt-2.5 font-label text-[11px] font-medium text-on-error-container">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 px-4 pt-3.5">
          {import.meta.env.DEV && (
            <button
              onClick={simulate}
              className="flex h-[52px] w-[104px] items-center justify-center rounded-2xl border border-outline-variant bg-surface-lowest font-label text-sm font-semibold text-on-surface-variant"
            >
              Simulate
            </button>
          )}
          <button
            onClick={end}
            disabled={ending || !activeTrip}
            className="flex h-[52px] flex-grow items-center justify-center gap-2 rounded-2xl bg-primary-container text-base font-bold text-on-primary-container disabled:opacity-60"
          >
            <StopIcon size={17} />
            {ending ? 'Finishing…' : 'End trip'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-grow flex-col">
      <span className="font-label text-[10px] font-bold tracking-wider text-outline">{label}</span>
      <span className="text-[26px] font-extrabold leading-[30px] tracking-tight">{value}</span>
      <span className="font-label text-[11px] font-semibold text-on-surface-variant">{sub}</span>
    </div>
  );
}
