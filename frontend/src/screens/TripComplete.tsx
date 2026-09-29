import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VerificationStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useJourney } from '../trip/JourneyContext';
import { co2, km, minutes, paceKmh } from '../lib/format';
import { AlertIcon, CheckIcon, CrossIcon } from '../components/icons';

const OUTCOME: Record<
  VerificationStatus,
  { title: string; blurb: string; ring: string; Icon: typeof CheckIcon }
> = {
  verified: {
    title: 'Trip verified',
    blurb: 'Your GPS track matched the route',
    ring: 'bg-success-container text-primary',
    Icon: CheckIcon,
  },
  flagged_review: {
    title: 'Held for review',
    blurb: 'The track looked unusually smooth, so a person will check it',
    ring: 'bg-tertiary-fixed text-on-tertiary-container',
    Icon: AlertIcon,
  },
  rejected: {
    title: 'Could not verify',
    blurb: 'The track strayed off the route or moved too fast for this mode',
    ring: 'bg-error-container text-on-error-container',
    Icon: CrossIcon,
  },
  unverified: {
    title: 'Trip saved',
    blurb: 'Not enough GPS was recorded to verify this one',
    ring: 'bg-surface-c text-outline',
    Icon: AlertIcon,
  },
};

export function TripComplete() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { finishedTrip, origin, destination, setSelection, setFinishedTrip } = useJourney();

  // The balance moved server-side inside the completion transaction.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!finishedTrip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-label text-sm text-on-surface-variant">Nothing to show yet.</p>
        <button onClick={() => navigate('/')} className="font-label text-sm font-bold text-primary">
          Back to the map
        </button>
      </div>
    );
  }

  const outcome = OUTCOME[finishedTrip.verificationStatus];
  const earned = finishedTrip.pointsAwarded;
  const saved = finishedTrip.co2SavedGrams ?? 0;
  // Distance actually covered, falling back to the plan for a trip that never
  // produced a usable trace.
  const covered = finishedTrip.actualDistanceMeters ?? finishedTrip.distanceMeters;
  // A verified trip can still score nothing: off campus, too short, or past a
  // daily cap. Saying so beats leaving someone to guess why they got zero.
  const refused =
    finishedTrip.verificationStatus === 'verified' && (finishedTrip.scoringDistanceMeters ?? 0) === 0;
  const durationSeconds = finishedTrip.endedAt
    ? (new Date(finishedTrip.endedAt).getTime() - new Date(finishedTrip.startedAt).getTime()) / 1000
    : 0;

  function done() {
    setSelection(null);
    setFinishedTrip(null);
    navigate('/');
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col items-center gap-4 px-6 pt-10">
        <div className={`flex h-[84px] w-[84px] items-center justify-center rounded-full ${outcome.ring}`}>
          <outcome.Icon size={40} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[26px] font-extrabold tracking-tight">{outcome.title}</span>
          <span className="text-center font-label text-[13px] font-medium text-on-surface-variant">
            {outcome.blurb}
          </span>
        </div>
      </div>

      <div
        className={`mx-4 mt-6 flex flex-col items-center gap-0.5 rounded-[20px] p-5 ${
          earned > 0 ? 'bg-primary-container' : 'bg-surface-c'
        }`}
      >
        <span
          className={`font-label text-[11px] font-bold tracking-wider ${
            earned > 0 ? 'text-on-primary-container' : 'text-outline'
          }`}
        >
          CO₂ AVOIDED
        </span>
        <span
          className={`text-[46px] font-extrabold leading-[52px] tracking-tight ${
            earned > 0 ? 'text-on-primary-container' : 'text-outline'
          }`}
        >
          {co2(saved)}
        </span>
        <span
          className={`font-label text-xs font-semibold ${
            earned > 0 ? 'text-on-primary-container' : 'text-outline'
          }`}
        >
          {earned > 0 ? `+${earned} points · balance ${user?.pointsBalance ?? 0}` : 'No points for this trip'}
        </span>
      </div>

      <div className="mx-4 mt-4 rounded-2xl border border-outline-variant bg-surface-lowest px-4">
        <Row label="Route" value={`${origin?.name ?? 'Start'} → ${destination?.name ?? 'End'}`} />
        <Row label="Distance" value={km(covered)} />
        <Row label="Time" value={minutes(durationSeconds)} />
        <Row
          label="Average pace"
          value={`${paceKmh(covered, durationSeconds)} km/h`}
          last
        />
      </div>

      {refused && (
        <p className="mx-4 mt-3 rounded-2xl bg-surface-c px-4 py-3 font-label text-[11px] leading-relaxed text-on-surface-variant">
          This one didn&apos;t count toward the boards — trips have to start and finish on campus, be at
          least 250m apart end to end, and fall inside your daily limit.
        </p>
      )}

      <div className="flex flex-grow" />

      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <button
          onClick={() => {
            done();
            navigate('/leaderboard');
          }}
          className="flex h-[52px] items-center justify-center rounded-2xl bg-primary-container text-base font-bold text-on-primary-container"
        >
          See the leaderboard
        </button>
        <button
          onClick={done}
          className="flex h-12 items-center justify-center rounded-2xl border border-outline-variant bg-surface-lowest font-label text-sm font-semibold text-on-surface-variant"
        >
          Back to map
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex h-[46px] items-center justify-between gap-4 ${last ? '' : 'border-b border-surface-c'}`}
    >
      <span className="font-label text-[13px] text-on-surface-variant">{label}</span>
      <span className="truncate text-sm font-semibold">{value}</span>
    </div>
  );
}
