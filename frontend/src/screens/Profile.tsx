import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { CoinIcon } from '../components/icons';

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const faculties = useApi(() => api.faculties(), []);
  const pending = useApi(() => api.myFacultyRequest(), []);

  const [requestedId, setRequestedId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myFaculty = faculties.data?.find((faculty) => faculty.id === user?.facultyId);

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestFacultyChange(requestedId, note);
      setRequestedId('');
      setNote('');
      pending.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Profile</h1>

      <section className="mt-4 rounded-2xl border border-outline-variant bg-surface-lowest p-3.5">
        <p className="text-lg font-bold text-on-surface">{user?.displayName ?? 'Anonymous'}</p>
        <p className="font-label text-xs text-outline">{user?.email}</p>
        <p className="mt-2 font-label text-xs font-bold text-on-primary-container">
          {myFaculty?.name ?? 'No faculty yet'}
        </p>
      </section>

      <h2 className="mt-5 font-label text-[11px] font-bold uppercase tracking-wider text-outline">
        Faculty
      </h2>

      {pending.data ? (
        <div className="mt-2 rounded-2xl border border-outline-variant bg-surface-low p-3.5">
          <p className="font-label text-xs font-bold text-on-surface">
            Pending: {pending.data.currentFacultyName ?? 'none'} → {pending.data.requestedFacultyName}
          </p>
          <p className="mt-1 font-label text-[11px] leading-relaxed text-outline">
            An admin has to approve this. You can&apos;t move yourself — the faculty board is a contest
            between groups, so switching would be too easy to abuse.
          </p>
        </div>
      ) : (
        <form onSubmit={submitRequest} className="mt-2 space-y-2">
          <select
            value={requestedId}
            onChange={(event) => setRequestedId(event.target.value)}
            required
            className="h-12 w-full rounded-2xl border border-outline-variant bg-surface-lowest px-3 font-label text-sm text-on-surface"
          >
            <option value="">Request a different faculty…</option>
            {faculties.data
              ?.filter((faculty) => faculty.id !== user?.facultyId)
              .map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
          </select>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why? e.g. transferred last term"
            className="h-12 w-full rounded-2xl border border-outline-variant bg-surface-lowest px-3 font-label text-sm text-on-surface"
          />
          {error && <p className="font-label text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy || !requestedId}
            className="h-[52px] w-full rounded-2xl bg-primary-container text-base font-bold text-on-primary-container disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Request change'}
          </button>
        </form>
      )}

      <h2 className="mt-5 font-label text-[11px] font-bold uppercase tracking-wider text-outline">
        Points
      </h2>
      <button
        type="button"
        onClick={() => navigate('/rewards')}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-outline-variant bg-surface-lowest p-3.5 text-left"
      >
        <CoinIcon size={22} className="text-tertiary" />
        <div className="flex-grow">
          <p className="text-sm font-bold text-on-surface">{user?.pointsBalance ?? 0} points</p>
          <p className="font-label text-[11px] text-outline">Spend them in the rewards catalogue</p>
        </div>
        <span className="font-label text-lg text-outline">›</span>
      </button>

      <button
        type="button"
        onClick={logout}
        className="mt-5 h-[52px] w-full rounded-2xl border border-outline-variant font-label text-sm font-bold text-on-surface-variant"
      >
        Log out
      </button>
    </div>
  );
}
