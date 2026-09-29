import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../api/hooks';

export function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Public endpoint, so the picker is populated before anyone has an account.
  const faculties = useApi(() => api.faculties(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === 'login' ? login(email, password) : signup(email, password, displayName, facultyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center px-6">
      <div className="mb-8 flex flex-col gap-1.5">
        <h1 className="text-[30px] font-extrabold tracking-tight text-primary">RouteFinder</h1>
        <p className="font-label text-[13px] text-on-surface-variant">
          Walk, run or cycle across Thammasat Rangsit. Every trip counts for you and your faculty.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-label text-[11px] font-bold tracking-wide text-outline">EMAIL</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-outline-variant bg-surface-lowest px-3.5 text-[15px] outline-none focus:border-primary-container"
            placeholder="you@dome.tu.ac.th"
          />
        </label>

        {mode === 'signup' && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-label text-[11px] font-bold tracking-wide text-outline">
                DISPLAY NAME
              </span>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-12 rounded-xl border border-outline-variant bg-surface-lowest px-3.5 text-[15px] outline-none focus:border-primary-container"
                placeholder="What the leaderboard shows"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-label text-[11px] font-bold tracking-wide text-outline">FACULTY</span>
              <select
                required
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="h-12 rounded-xl border border-outline-variant bg-surface-lowest px-3.5 text-[15px] outline-none focus:border-primary-container"
              >
                <option value="">Pick your faculty…</option>
                {faculties.data?.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
              <span className="font-label text-[11px] text-outline">
                You compete for this faculty. Changing it later needs an admin&apos;s approval.
              </span>
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-label text-[11px] font-bold tracking-wide text-outline">PASSWORD</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border border-outline-variant bg-surface-lowest px-3.5 text-[15px] outline-none focus:border-primary-container"
            placeholder="At least 8 characters"
          />
        </label>

        {error && (
          <div className="rounded-xl bg-error-container px-3.5 py-3 font-label text-[13px] font-medium text-on-error-container">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-[52px] items-center justify-center rounded-2xl bg-primary-container text-base font-bold text-on-primary-container disabled:opacity-60"
        >
          {busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError(null);
        }}
        className="mt-5 font-label text-[13px] font-semibold text-primary"
      >
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
