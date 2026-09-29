import { api } from '../api/client';
import { useApi } from '../api/hooks';
import type { Trip } from '../api/types';
import { dayLabel, km, timeOfDay } from '../lib/format';
import { MODE_ICON } from '../components/icons';
import { VerificationBadge } from '../components/VerificationBadge';

export function Activity() {
  const trips = useApi(() => api.trips(), []);

  const totals = (trips.data ?? []).reduce(
    (acc, trip) => ({
      count: acc.count + 1,
      meters: acc.meters + trip.distanceMeters,
      points: acc.points + trip.pointsAwarded,
    }),
    { count: 0, meters: 0, points: 0 }
  );

  const groups = (trips.data ?? []).reduce<Record<string, Trip[]>>((acc, trip) => {
    const key = dayLabel(trip.startedAt);
    (acc[key] ??= []).push(trip);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-4 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Activity</h1>
      </div>

      <div className="mx-4 mb-3.5 flex justify-between rounded-2xl border border-outline-variant bg-surface-lowest p-3.5">
        <Total label="TRIPS" value={String(totals.count)} />
        <Total label="DISTANCE" value={km(totals.meters)} />
        <Total label="EARNED" value={String(totals.points)} accent />
      </div>

      {trips.loading && <p className="px-4 font-label text-xs text-outline">Loading trips…</p>}
      {trips.error && (
        <p className="px-4 font-label text-xs text-on-error-container">{trips.error}</p>
      )}
      {trips.data?.length === 0 && (
        <p className="px-4 font-label text-xs text-outline">
          No trips yet — start one from the map.
        </p>
      )}

      {Object.entries(groups).map(([day, dayTrips]) => (
        <div key={day}>
          <div className="px-4 pb-1.5 pt-3 font-label text-[11px] font-bold tracking-wider text-outline">
            {day.toUpperCase()}
          </div>
          <div className="flex flex-col gap-2 px-4">
            {dayTrips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      ))}

      <div className="h-5" />
    </div>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-label text-[10px] font-bold tracking-wider text-outline">{label}</span>
      <span
        className={`text-[19px] font-extrabold tracking-tight ${accent ? 'text-primary' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const Icon = MODE_ICON[trip.travelMode];
  const earned = trip.pointsAwarded > 0;
  const tint =
    trip.verificationStatus === 'verified'
      ? 'bg-success-container text-on-primary-container'
      : trip.verificationStatus === 'flagged_review'
        ? 'bg-tertiary-fixed text-on-tertiary-container'
        : trip.verificationStatus === 'rejected'
          ? 'bg-error-container text-on-error-container'
          : 'bg-surface-c text-outline';

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-lowest px-3.5 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${tint}`}>
        <Icon size={19} />
      </div>
      <div className="flex flex-grow flex-col gap-1">
        <span className="text-sm font-bold capitalize">{trip.travelMode} trip</span>
        <div className="flex items-center gap-1.5">
          <VerificationBadge status={trip.verificationStatus} />
          <span className="font-label text-[11px] text-on-surface-variant">
            {km(trip.distanceMeters)} · {timeOfDay(trip.startedAt)}
          </span>
        </div>
      </div>
      <span
        className={`font-label text-sm font-bold ${earned ? 'text-primary' : 'text-outline'}`}
      >
        {earned ? `+${trip.pointsAwarded}` : '0'}
      </span>
    </div>
  );
}
