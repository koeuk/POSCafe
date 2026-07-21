"use client";

import { usePathname } from "next/navigation";
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
import { applyThemeColors, type ThemeColorSet } from "@/lib/branding-colors";

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
  // Themeable colours (hex). null = use the built-in default for that surface.
  // Light mode and dark mode each have their own set so a colour picked for
  // one mode never clashes with the other mode's text/borders.
  buttonColor: string | null;
  pageBg: string | null;
  sidebarBg: string | null;
  sidebarActiveColor: string | null;
  buttonColorDark: string | null;
  pageBgDark: string | null;
  sidebarBgDark: string | null;
  sidebarActiveColorDark: string | null;
}

const DEFAULTS: AppSettings = {
  appName: "POSCAFE",
  logoUrl: null,
  buttonColor: null,
  pageBg: null,
  sidebarBg: null,
  sidebarActiveColor: null,
  buttonColorDark: null,
  pageBgDark: null,
  sidebarBgDark: null,
  sidebarActiveColorDark: null,
};

// Persisted so custom colours apply on first paint (before the fetch lands),
// avoiding a flash of the default theme.
const CACHE_KEY = "poscafe-branding";

/** The light-mode colour set stored in the settings. */
export function lightColorSet(s: AppSettings): ThemeColorSet {
  return {
    buttonColor: s.buttonColor,
    pageBg: s.pageBg,
    sidebarBg: s.sidebarBg,
    sidebarActiveColor: s.sidebarActiveColor,
  };
}

/** The dark-mode colour set stored in the settings. */
export function darkColorSet(s: AppSettings): ThemeColorSet {
  return {
    buttonColor: s.buttonColorDark,
    pageBg: s.pageBgDark,
    sidebarBg: s.sidebarBgDark,
    sidebarActiveColor: s.sidebarActiveColorDark,
  };
}

/** Reflect both palettes on the page (per-mode, via a managed style tag). */
function applyColors(settings: AppSettings) {
  applyThemeColors(lightColorSet(settings), darkColorSet(settings));
}

// Best-guess MIME type for a favicon URL, so the browser accepts non-.ico
// images (uploaded logos are usually PNG/JPEG/WebP/SVG).
function iconMimeType(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    default:
      return null;
  }
}

/**
 * Reflect the branding in the browser tab: document title = app name, and the
 * favicon = the uploaded logo (falling back to the default mark). Kept in sync
 * imperatively because the title/icon are dynamic (admin-configurable).
 */
function applyDocumentBranding(settings: AppSettings) {
  if (typeof document === "undefined") return;

  document.title = settings.appName || DEFAULTS.appName;

  const href = settings.logoUrl || "/favicon.ico";
  const type = iconMimeType(href);

  // Manage a single icon <link> that we own (data-app-icon) and update it in
  // place. We deliberately do NOT remove framework-injected icon links:
  // deleting <head> nodes that React/Next still track corrupts their fiber
  // tree and throws "Cannot read properties of null (reading 'removeChild')"
  // on the next navigation. A trailing <link rel="icon"> wins in the browser
  // anyway, so ours takes effect without touching their nodes.
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[data-app-icon="true"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.dataset.appIcon = "true";
    document.head.appendChild(link);
  }
  if (type) link.type = type;
  else link.removeAttribute("type");
  link.href = href;
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
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      // GET /settings is public — works before login too.
      const data = await api<AppSettings>("/settings");
      const next: AppSettings = { ...DEFAULTS, ...data };
      setSettings(next);
      applyColors(next);
      applyDocumentBranding(next);
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
    applyDocumentBranding(cached);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(cached);
    void refresh();
  }, [refresh]);

  // Re-assert the tab title + favicon after each navigation: Next re-applies
  // the static metadata title on soft navigations, which would otherwise
  // overwrite the dynamic app name.
  useEffect(() => {
    applyDocumentBranding(settings);
  }, [settings, pathname]);

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
