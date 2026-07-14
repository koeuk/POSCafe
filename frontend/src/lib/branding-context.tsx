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
import { api } from "@/lib/api";

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
  // Themeable colours (hex). null = use the built-in default for that surface.
  buttonColor: string | null;
  pageBg: string | null;
  sidebarBg: string | null;
  sidebarActiveColor: string | null;
}

const DEFAULTS: AppSettings = {
  appName: "POSCAFE",
  logoUrl: null,
  buttonColor: null,
  pageBg: null,
  sidebarBg: null,
  sidebarActiveColor: null,
};

// Persisted so custom colours apply on first paint (before the fetch lands),
// avoiding a flash of the default theme.
const CACHE_KEY = "poscafe-branding";

// Which settings field drives which CSS variable (see globals.css defaults).
const COLOR_VARS: Record<string, keyof AppSettings> = {
  "--pos-button": "buttonColor",
  "--pos-page": "pageBg",
  "--pos-sidebar": "sidebarBg",
  "--pos-active": "sidebarActiveColor",
};

/** Push (or clear) the colour overrides as inline CSS variables on <html>. */
function applyColors(settings: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [cssVar, field] of Object.entries(COLOR_VARS)) {
    const value = settings[field];
    if (typeof value === "string" && value) {
      root.style.setProperty(cssVar, value);
    } else {
      root.style.removeProperty(cssVar); // fall back to the globals.css default
    }
  }
}

function readCache(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore malformed cache
  }
  return DEFAULTS;
}

interface BrandingContextValue extends AppSettings {
  /** Re-fetch settings from the backend (call after saving changes). */
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const refresh = useCallback(async () => {
    try {
      // GET /settings is public — works before login too.
      const data = await api<AppSettings>("/settings");
      const next: AppSettings = { ...DEFAULTS, ...data };
      setSettings(next);
      applyColors(next);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / private-mode errors
      }
    } catch {
      // Keep whatever we have (cache or defaults) if the request fails.
    }
  }, []);

  useEffect(() => {
    // Apply the cached branding immediately (avoids a theme flash), then
    // refresh from the backend. Intentional post-mount state sync.
    const cached = readCache();
    applyColors(cached);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(cached);
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...settings, refresh }), [settings, refresh]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return ctx;
}
