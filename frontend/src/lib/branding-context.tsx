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
}

const DEFAULTS: AppSettings = { appName: "POSCAFE", logoUrl: null };

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
      setSettings({ appName: data.appName, logoUrl: data.logoUrl });
    } catch {
      // Keep whatever we have (defaults) if the request fails.
    }
  }, []);

  useEffect(() => {
    // Mount fetch: loading branding after mount is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ ...settings, refresh }),
    [settings, refresh],
  );

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
