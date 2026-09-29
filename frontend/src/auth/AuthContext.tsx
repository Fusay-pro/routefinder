import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api/client';
import type { User } from '../api/types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signup: (email: string, password: string, displayName: string, facultyId: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    setUser(await api.me());
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      signup: async (email, password, displayName, facultyId) => {
        const result = await api.signup(email, password, displayName, facultyId);
        setToken(result.token);
        setUser(result.user);
      },
      login: async (email, password) => {
        const result = await api.login(email, password);
        setToken(result.token);
        setUser(result.user);
      },
      logout: () => {
        setToken(null);
        setUser(null);
      },
      refresh,
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
