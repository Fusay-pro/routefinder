import { useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/format';
import { CoinIcon } from '../components/icons';

export function Rewards() {
  const { user, refresh } = useAuth();
  const catalog = useApi(() => api.catalog(), []);
  const history = useApi(() => api.redemptions(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance = user?.pointsBalance ?? 0;

  async function redeem(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.redeem(id);
      await refresh();
      history.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redeem');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-4 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Rewards</h1>
      </div>

      <div className="mx-4 flex flex-col gap-3 rounded-[20px] bg-primary p-5">
        <div className="flex items-end gap-2">
          <span className="text-[44px] font-extrabold leading-[46px] tracking-tight text-white">
            {balance}
          </span>
          <span className="pb-2 font-label text-sm font-semibold text-primary-fixed">points</span>
        </div>
        <span className="font-label text-[11px] font-medium text-primary-fixed-dim">
          Earned by walking and biking — vehicles earn nothing.
        </span>
      </div>

      <div className="px-4 pb-2 pt-5 font-label text-[11px] font-bold tracking-wider text-outline">
        SPEND YOUR POINTS
      </div>

      {error && (
        <p className="px-4 pb-2 font-label text-xs font-medium text-on-error-container">{error}</p>
      )}

      <div className="flex flex-col gap-2.5 px-4">
        {catalog.loading && <p className="font-label text-xs text-outline">Loading catalog…</p>}
        {catalog.error && (
          <p className="font-label text-xs text-on-error-container">Catalog unavailable</p>
        )}
        {catalog.data?.length === 0 && (
          <p className="font-label text-xs text-outline">Nothing in the catalog yet.</p>
        )}

        {catalog.data?.map((item) => {
          const affordable = balance >= item.pointCost;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl p-3.5 ${
                affordable
                  ? 'border border-outline-variant bg-surface-lowest'
                  : 'border border-dashed border-outline-variant bg-surface-low'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  affordable ? 'bg-success-container text-primary' : 'bg-surface-highest text-outline'
                }`}
              >
                <CoinIcon size={22} />
              </div>
              <div className="flex flex-grow flex-col gap-0.5">
                <span className={`text-[15px] font-bold ${affordable ? '' : 'text-outline'}`}>
                  {item.name}
                </span>
                <span
                  className={`font-label text-[11px] font-medium ${
                    affordable ? 'text-on-surface-variant' : 'text-tertiary'
                  }`}
                >
                  {affordable
                    ? (item.description ?? 'Campus perk')
                    : `${item.pointCost - balance} points to go`}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`font-label text-[13px] font-bold ${
                    affordable ? 'text-primary' : 'text-outline'
                  }`}
                >
                  {item.pointCost} pts
                </span>
                <button
                  disabled={!affordable || busyId === item.id}
                  onClick={() => redeem(item.id)}
                  className={`flex h-8 items-center rounded-full px-3.5 font-label text-xs font-bold ${
                    affordable
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-highest text-outline'
                  }`}
                >
                  {busyId === item.id ? '…' : affordable ? 'Redeem' : 'Locked'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(history.data?.length ?? 0) > 0 && (
        <>
          <div className="px-4 pb-2 pt-5 font-label text-[11px] font-bold tracking-wider text-outline">
            REDEEMED
          </div>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {history.data?.map((redemption) => (
              <div
                key={redemption.id}
                className="flex items-center justify-between rounded-xl bg-surface-low px-3.5 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{redemption.catalogItemName}</span>
                  <span className="font-label text-[11px] text-on-surface-variant">
                    {relativeTime(redemption.redeemedAt)}
                  </span>
                </div>
                <span className="font-label text-[13px] font-bold text-on-surface-variant">
                  −{redemption.pointsSpent}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h-4" />
    </div>
  );
}
