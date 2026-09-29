import { useState } from 'react';
import { api, type BoardQuery } from '../api/client';
import { useApi } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { co2, km, ordinal } from '../lib/format';
import { LeafIcon } from '../components/icons';
import type { BoardActivity, BoardMetric, BoardScope, BoardWindow } from '../api/types';

const METRICS: { value: BoardMetric; label: string }[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'co2', label: 'CO₂ avoided' },
];

const ACTIVITIES: { value: BoardActivity; label: string }[] = [
  { value: 'foot', label: 'On foot' },
  { value: 'cycle', label: 'Cycling' },
];

const SCOPES: { value: BoardScope; label: string }[] = [
  { value: 'individual', label: 'People' },
  { value: 'faculty', label: 'Faculties' },
];

const WINDOWS: { value: BoardWindow; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

function formatValue(metric: BoardMetric, value: number): string {
  return metric === 'co2' ? co2(value) : km(value);
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-c p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 font-label text-xs font-bold transition-colors ${
            option.value === value
              ? 'bg-surface-lowest text-on-primary-container shadow-chip'
              : 'text-on-surface-variant'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  // Only the top three get colour — a board where every row shouts has no top.
  const tone =
    rank === 1
      ? 'bg-tertiary-container text-on-tertiary-container'
      : rank <= 3
        ? 'bg-success-container text-on-primary-container'
        : 'bg-surface-c text-on-surface-variant';
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-label text-sm font-bold ${tone}`}>
      {rank}
    </span>
  );
}

export function Leaderboard() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<BoardMetric>('distance');
  const [activity, setActivity] = useState<BoardActivity>('foot');
  const [scope, setScope] = useState<BoardScope>('individual');
  const [window, setWindow] = useState<BoardWindow>('week');

  const query: BoardQuery = { metric, activity, window };

  // Two calls rather than one returning a union: the row shapes genuinely
  // differ, and the inactive one resolves without making a request.
  const people = useApi(
    () => (scope === 'individual' ? api.individualBoard(query) : Promise.resolve(null)),
    [metric, activity, window, scope]
  );
  const faculties = useApi(
    () => (scope === 'faculty' ? api.facultyBoard(query) : Promise.resolve(null)),
    [metric, activity, window, scope]
  );
  const standing = useApi(() => api.myStanding(query), [metric, activity, window]);

  const board = scope === 'individual' ? people : faculties;
  const peopleRows = people.data?.rows ?? [];
  const facultyRows = faculties.data?.rows ?? [];
  const isEmpty = (scope === 'individual' ? peopleRows : facultyRows).length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Leaderboard</h1>
        <p className="mt-0.5 font-label text-xs text-outline">
          Verified trips across campus. Motor vehicles don&apos;t count.
        </p>
      </header>

      <div className="space-y-2 px-4 pb-3">
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Segmented options={ACTIVITIES} value={activity} onChange={setActivity} />
          </div>
          <div className="flex-1">
            <Segmented options={METRICS} value={metric} onChange={setMetric} />
          </div>
        </div>
        <Segmented options={WINDOWS} value={window} onChange={setWindow} />
      </div>

      <div className="min-h-0 flex-grow overflow-y-auto px-4 pb-4">
        {board.loading && <p className="py-8 text-center font-label text-sm text-outline">Loading…</p>}
        {board.error && <p className="py-8 text-center font-label text-sm text-error">{board.error}</p>}
        {!board.loading && !board.error && isEmpty && (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-5 text-center">
            <p className="font-label text-sm font-bold text-on-surface">Nothing here yet</p>
            <p className="mt-1 font-label text-xs text-outline">
              No verified {activity === 'cycle' ? 'rides' : 'walks or runs'} in this window. Be the first.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {scope === 'individual'
            ? peopleRows.map((row) => (
                <li
                  key={row.userId}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    row.userId === user?.id
                      ? 'border-primary-container bg-success-container'
                      : 'border-outline-variant bg-surface-lowest'
                  }`}
                >
                  <RankBadge rank={row.rank} />
                  <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-bold text-on-surface">
                      {row.displayName ?? 'Anonymous'}
                      {row.userId === user?.id && <span className="ml-1 text-on-primary-container">· you</span>}
                    </p>
                    <p className="truncate font-label text-[11px] text-outline">
                      {row.facultyName ?? 'No faculty'} · {row.tripCount} trip{row.tripCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-on-surface">
                    {formatValue(metric, row.value)}
                  </span>
                </li>
              ))
            : facultyRows.map((row) => (
                <li
                  key={row.facultyId}
                  className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-lowest p-3"
                >
                  <RankBadge rank={row.rank} />
                  <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-bold text-on-surface">{row.name}</p>
                    <p className="truncate font-label text-[11px] text-outline">
                      {row.activeMembers} active · {formatValue(metric, row.totalValue)} total
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-on-surface">
                    {formatValue(metric, row.valuePerMember)}
                  </span>
                </li>
              ))}
        </ul>

        {scope === 'faculty' && facultyRows.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 font-label text-[11px] leading-relaxed text-outline">
            <LeafIcon size={14} className="mt-px shrink-0" />
            <span>
              Ranked per active member, not on totals — otherwise the biggest faculty wins every week
              regardless of what anyone does.
            </span>
          </p>
        )}
      </div>

      {/* Sticky, so your own position is answerable without scrolling a board
          you might be four hundred rows down. */}
      <div className="border-t border-surface-c bg-surface-lowest px-4 py-3">
        {standing.data && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-grow">
              <p className="font-label text-[11px] font-bold uppercase tracking-wider text-outline">
                Your standing
              </p>
              <p className="text-sm font-bold text-on-surface">
                {standing.data.rank === null
                  ? 'Unranked this window'
                  : `${ordinal(standing.data.rank)} of ${standing.data.totalRanked}`}
              </p>
            </div>
            <span className="text-lg font-extrabold tabular-nums text-on-primary-container">
              {formatValue(metric, standing.data.value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
