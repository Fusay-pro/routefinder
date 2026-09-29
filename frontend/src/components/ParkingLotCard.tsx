import type { ParkingLotSummary } from '../api/types';
import { relativeTime } from '../lib/format';

/**
 * Free / occupied / unknown are three separate things. A lot with no sensors
 * reporting must never read as "full" — hence the hatched third segment rather
 * than folding unknown into occupied.
 */
export function ParkingLotCard({ lot }: { lot: ParkingLotSummary }) {
  const total = Math.max(lot.totalSpots, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const noData = lot.freeSpots + lot.occupiedSpots === 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-grow text-[15px] font-bold">{lot.name}</span>
        {lot.permitTier && (
          <span className="flex h-[21px] items-center rounded-md bg-tertiary-fixed px-2 font-label text-[10px] font-bold text-on-tertiary-container">
            PERMIT {lot.permitTier}
          </span>
        )}
        <span className="font-label text-[10px] font-medium text-outline">
          {relativeTime(lot.lastUpdated)}
        </span>
      </div>

      {noData ? (
        <div className="bg-hatched h-2 rounded-full" />
      ) : (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <div style={{ width: pct(lot.freeSpots) }} className="bg-primary-container" />
          <div style={{ width: pct(lot.occupiedSpots) }} className="bg-on-surface-variant" />
          <div style={{ width: pct(lot.unknownSpots) }} className="bg-hatched" />
        </div>
      )}

      {noData ? (
        <span className="font-label text-xs font-semibold text-outline">
          No sensors reporting — availability unknown
        </span>
      ) : (
        <div className="flex gap-3.5">
          <Legend swatch="bg-primary-container" value={lot.freeSpots} label="free" />
          <Legend swatch="bg-on-surface-variant" value={lot.occupiedSpots} label="taken" />
          <Legend swatch="bg-hatched" value={lot.unknownSpots} label="no sensor" muted />
        </div>
      )}
    </div>
  );
}

function Legend({
  swatch,
  value,
  label,
  muted,
}: {
  swatch: string;
  value: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${swatch}`} />
      <span className={`font-label text-xs font-bold ${muted ? 'text-outline' : 'text-on-surface'}`}>
        {value}
      </span>
      <span className={`font-label text-xs ${muted ? 'text-outline' : 'text-on-surface-variant'}`}>
        {label}
      </span>
    </div>
  );
}
