import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, userApi } from '@/api/endpoints';
import type { AuthResponseDTO, UserDTO } from '@/api/types';
import { AUTH_EXPIRED_EVENT, tokenStore } from '@/lib/http';

interface AuthContextValue {
  user: UserDTO | null;
  isAuthenticated: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  /** True until the stored session has been re-validated against /users/me. */
  loading: boolean;
  login: (email: string, password: string) => Promise<UserDTO>;
  loginWithGoogle: (idToken: string) => Promise<UserDTO>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
    otp: string;
    phone?: string;
  }) => Promise<UserDTO>;
  logout: () => Promise<void>;
  /** Replaces the cached user after a profile update. */
  setUser: (user: UserDTO) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): UserDTO | null {
  const raw = tokenStore.rawUser();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserDTO;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserDTO | null>(() => readStoredUser());
  const [loading, setLoading] = useState<boolean>(() => Boolean(tokenStore.access()));

  const applySession = useCallback((auth: AuthResponseDTO) => {
    tokenStore.set(auth.accessToken, auth.refreshToken, auth.user);
    setUserState(auth.user);
    return auth.user;
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
  }, []);

  // A failed token refresh anywhere in the app drops the session here.
  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearSession]);

  // Re-validate a session restored from localStorage: the token may have
  // expired, or the account's role may have changed since it was issued.
  useEffect(() => {
    if (!tokenStore.access()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const bundle = await userApi.me();
        if (cancelled) return;
        setUserState(bundle.user);
        tokenStore.setUser(bundle.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => applySession(await authApi.login(email, password)),
    [applySession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => applySession(await authApi.googleLogin(idToken)),
    [applySession],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; name: string; otp: string; phone?: string }) =>
      applySession(await authApi.register(payload)),
    [applySession],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh();
    if (refreshToken) {
      // Best effort: the session is dropped locally even if the call fails.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const setUser = useCallback((next: UserDTO) => {
    setUserState(next);
    tokenStore.setUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const bundle = await userApi.me();
    setUser(bundle.user);
  }, [setUser]);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? '';
    return {
      user,
      isAuthenticated: Boolean(user),
      isStaff: role === 'ROLE_STAFF' || role === 'ROLE_ADMIN',
      isAdmin: role === 'ROLE_ADMIN',
      loading,
      login,
      loginWithGoogle,
      register,
      logout,
      setUser,
      refreshUser,
    };
  }, [user, loading, login, loginWithGoogle, register, logout, setUser, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
