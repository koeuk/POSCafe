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

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "poscafe-theme";

interface ThemeContextValue {
  /** The user's chosen preference (may be "system"). */
  theme: Theme;
  /** The actually-applied theme after resolving "system". */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  /** Convenience: flip between light and dark (ignores system). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline no-flash script (in layout) has already set the class before
  // paint; here we just read the stored preference to drive the UI.
  const [theme, setThemeState] = useState<Theme>("system");
  // Until mounted, `resolved` stays deterministic ("light") so the server and
  // first client render agree. `systemPrefersDark()` reads window.matchMedia,
  // which is false on the server but the real OS value on the client — using it
  // during the first render would mismatch and break hydration.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      // Intentional: the initial render stays "system" to match the SSR
      // output and the inline no-flash script; we sync the stored preference
      // into state only after hydration, so this is not a render-time update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(stored);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  // Keep "system" in sync with OS changes while it's the active preference.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const resolved: "light" | "dark" = !mounted
    ? // Deterministic on the server and the first client render.
      theme === "system"
      ? "light"
      : theme
    : theme === "system"
      ? systemPrefersDark()
        ? "dark"
        : "light"
      : theme;

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
