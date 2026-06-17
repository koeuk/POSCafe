"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken } from "./api";
import { Role, type AuthResponse, type User } from "./types";

const USER_KEY = "poscafe_user";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from a stored token on first load.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const token = getToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Optimistically show the cached user while we verify the token.
      const cached = localStorage.getItem(USER_KEY);
      if (cached && !cancelled) {
        try {
          setUser(JSON.parse(cached) as User);
        } catch {
          // ignore corrupt cache
        }
      }

      try {
        // Verify the token is still valid against the backend.
        const me = await api<User>("/auth/me");
        if (!cancelled) setUser((prev) => ({ ...prev, ...me }));
      } catch {
        clearToken();
        localStorage.removeItem(USER_KEY);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<AuthResponse>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setToken(res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === Role.ADMIN,
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
