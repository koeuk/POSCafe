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

/**
 * Readable text colour (near-black or near-white) for a given hex background,
 * by perceived luminance. Keeps label text legible on whatever accent colour
 * an admin picks — otherwise a dark custom button colour leaves the built-in
 * dark button text unreadable.
 */
function readableForeground(hex: string): string {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#fff7ed";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0c0a09" : "#fff7ed";
}

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

  // Pair a readable foreground with a custom accent colour so text on the
  // accent stays legible; clear it to fall back to the per-mode default.
  if (settings.buttonColor) {
    root.style.setProperty(
      "--pos-button-fg",
      readableForeground(settings.buttonColor),
    );
  } else {
    root.style.removeProperty("--pos-button-fg");
  }
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
