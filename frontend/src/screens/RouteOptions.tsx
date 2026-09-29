import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Mode, RouteResult } from '../api/types';
import { useJourney } from '../trip/JourneyContext';
import { km, minutes } from '../lib/format';
import { ArrowRightIcon, BackIcon, CoinIcon, MODE_ICON } from '../components/icons';

type Entry = { route: RouteResult | null; loading: boolean; error: string | null };

const EAGER: Mode[] = ['walk', 'bike'];
const ON_DEMAND: Mode[] = ['car', 'motorcycle'];

const LABEL: Record<Mode, { title: string; sub: string }> = {
  walk: { title: 'Walk', sub: 'Campus paths' },
  bike: { title: 'Bike', sub: 'Your own bike' },
  car: { title: 'Drive', sub: 'Park and walk in' },
  motorcycle: { title: 'Motorcycle', sub: 'Park and walk in' },
};

export function RouteOptions() {
  const navigate = useNavigate();
  const { origin, destination, setSelection } = useJourney();
  const [entries, setEntries] = useState<Partial<Record<Mode, Entry>>>({});

  const load = useCallback(
    async (mode: Mode) => {
      if (!origin || !destination) return;
      setEntries((prev) => ({ ...prev, [mode]: { route: null, loading: true, error: null } }));
      try {
        const route = await api.route(origin, destination, mode);
        setEntries((prev) => ({ ...prev, [mode]: { route, loading: false, error: null } }));
      } catch (err) {
        setEntries((prev) => ({
          ...prev,
          [mode]: {
            route: null,
            loading: false,
            error: err instanceof Error ? err.message : 'No route found',
          },
        }));
      }
    },
    [origin, destination]
  );

  // Walk and bike run on our own graph and cost nothing, so they load up front.
  // Car and motorcycle can hit the paid Google Routes API, so they wait for a tap.
  useEffect(() => {
    EAGER.forEach(load);
  }, [load]);

  if (!origin || !destination) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-label text-sm text-on-surface-variant">Pick a destination first.</p>
        <button onClick={() => navigate('/')} className="font-label text-sm font-bold text-primary">
          Back to the map
        </button>
      </div>
    );
  }

  function start(mode: Mode, route: RouteResult) {
    setSelection({ mode, route });
    navigate('/trip');
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
        <button
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-lowest"
        >
          <BackIcon size={20} />
        </button>
        <div className="flex flex-col">
          <span className="text-[19px] font-extrabold tracking-tight">How to get there</span>
          <span className="font-label text-[11px] font-medium text-on-surface-variant">
            {origin.name} → {destination.name}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-2">
        {EAGER.map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            entry={entries[mode]}
            highlight={mode === 'walk'}
            onStart={start}
            onRetry={() => load(mode)}
          />
        ))}

        {ON_DEMAND.map((mode) =>
          entries[mode] ? (
            <ModeCard
              key={mode}
              mode={mode}
              entry={entries[mode]}
              onStart={start}
              onRetry={() => load(mode)}
            />
          ) : (
            <button
              key={mode}
              onClick={() => load(mode)}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-lowest p-3.5 text-left"
            >
              <ModeGlyph mode={mode} />
              <div className="flex flex-grow flex-col">
                <span className="text-[15px] font-bold">{LABEL[mode].title}</span>
                <span className="font-label text-[11px] text-on-surface-variant">
                  Tap to check — uses the paid traffic API
                </span>
              </div>
              <ArrowRightIcon size={18} className="text-outline" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

function ModeGlyph({ mode }: { mode: Mode }) {
  const Icon = MODE_ICON[mode];
  const tint =
    mode === 'walk'
      ? 'bg-success-container text-on-primary-container'
      : mode === 'bike'
        ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
        : 'bg-surface-c text-on-surface-variant';
  return (
    <div className={`flex h-[38px] w-[38px] items-center justify-center rounded-xl ${tint}`}>
      <Icon size={21} />
    </div>
  );
}

function ModeCard({
  mode,
  entry,
  highlight,
  onStart,
  onRetry,
}: {
  mode: Mode;
  entry?: Entry;
  highlight?: boolean;
  onStart: (mode: Mode, route: RouteResult) => void;
  onRetry: () => void;
}) {
  const route = entry?.route;
  const earns = (route?.estimatedPoints ?? 0) > 0;

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl bg-surface-lowest p-3.5 ${
        highlight && route ? 'border-2 border-primary-container' : 'border border-outline-variant'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <ModeGlyph mode={mode} />
        <div className="flex flex-grow flex-col">
          <span className="text-[17px] font-bold">{LABEL[mode].title}</span>
          <span className="font-label text-[11px] font-medium text-on-surface-variant">
            {LABEL[mode].sub}
          </span>
        </div>
        <div className="flex flex-col items-end">
          {entry?.loading && <span className="font-label text-xs text-outline">Checking…</span>}
          {entry?.error && (
            <button onClick={onRetry} className="font-label text-xs font-semibold text-on-error-container">
              {entry.error} · retry
            </button>
          )}
          {route && (
            <>
              <span className="text-2xl font-extrabold leading-[26px] tracking-tight text-on-surface">
                {minutes(route.seconds)}
              </span>
              <span className="font-label text-[11px] font-semibold text-on-surface-variant">
                {km(route.distanceMeters)}
              </span>
            </>
          )}
        </div>
      </div>

      {route && (
        <>
          <div
            className={`flex h-[38px] items-center gap-2 rounded-xl px-3 ${
              earns ? 'bg-success-container' : 'bg-surface-low'
            }`}
          >
            <CoinIcon size={17} className={earns ? 'text-on-primary-container' : 'text-outline'} />
            <span
              className={`font-label text-[13px] font-bold ${
                earns ? 'text-on-primary-container' : 'text-outline'
              }`}
            >
              {earns ? `Earn ${route.estimatedPoints} points` : 'No points for this mode'}
            </span>
            {earns && (
              <span className="flex-grow text-right font-label text-[11px] font-medium text-on-surface-variant">
                if GPS verifies
              </span>
            )}
          </div>

          <button
            onClick={() => onStart(mode, route)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-container text-sm font-bold text-on-primary-container"
          >
            Start {LABEL[mode].title.toLowerCase()} trip
            <ArrowRightIcon size={16} />
          </button>
        </>
      )}
    </div>
  );
}
