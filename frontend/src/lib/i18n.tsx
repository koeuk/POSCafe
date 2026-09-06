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
import { auth } from "./translations/auth";
import { categories } from "./translations/categories";
import { common } from "./translations/common";
import { dashboard } from "./translations/dashboard";
import { menu } from "./translations/menu";
import { orders } from "./translations/orders";
import { pay } from "./translations/pay";
import { pos } from "./translations/pos";
import { products } from "./translations/products";
import { reports } from "./translations/reports";
import { settings } from "./translations/settings";
import { sidebar } from "./translations/sidebar";
import { stock } from "./translations/stock";


export type Locale = "en" | "km";

const STORAGE_KEY = "poscafe-locale";
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "km", label: "ខ្មែរ" },
];

// The English text is the key, so a component reads `t("Overview")` and the
// English UI needs no dictionary at all. Khmer is split into one module per
// area under lib/translations/; `TranslationKey` is derived from the merged
// map, so a `t("...")` call with text that has no Khmer entry is a compile
// error. A key may live in only one module — check `common` first.
const km = {
  ...common,
  ...sidebar,
  ...dashboard,
  ...pos,
  ...pay,
  ...orders,
  ...products,
  ...categories,
  ...stock,
  ...reports,
  ...settings,
  ...auth,
  ...menu,
} as const;

export type TranslationKey = keyof typeof km;

export type TranslateVars = Record<string, string | number>;

/**
 * Translate a key, filling `{name}` placeholders from `vars`:
 * `t("{n} left", { n: 6 })` → "នៅសល់ 6". Placeholders let Khmer reorder
 * the words instead of gluing `t("left")` onto a number.
 */
export type Translate = (key: TranslationKey, vars?: TranslateVars) => string;

// Date helpers. They build the English form with Intl (always available) and
// translate its tokens, since Khmer locale data is missing from most browsers.

/** "Mon" → "ចន្ទ" */
export function formatWeekdayShort(date: Date, t: Translate): string {
  const key = date.toLocaleDateString("en-US", { weekday: "short" });
  return t(key as TranslationKey);
}

/** "Sep" → "កញ្ញា", or "Sep 26" with a two-digit year when asked. */
export function formatMonthShort(
  date: Date,
  t: Translate,
  withYear = false,
): string {
  const key = date.toLocaleDateString("en-US", { month: "short" });
  const month = t(key as TranslationKey);
  return withYear
    ? `${month} ${date.toLocaleDateString("en-US", { year: "2-digit" })}`
    : month;
}

/** "2:10 PM" → "2:10 ល្ងាច" */
export function formatTimeShort(date: Date, t: Translate): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\b(AM|PM)\b/, (m) => t(m as TranslationKey));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "km";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always "en" on the server and first client render so hydration matches;
  // the stored preference is applied right after mount (same as the theme).
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      // Storage unavailable — stay on the default.
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice lasts for this page load only.
    }
  }, []);

  // English is the key itself; any other locale falls back to it.
  const t = useCallback<Translate>(
    (key, vars) => {
      const text: string = locale === "en" ? key : (km[key] ?? key);
      if (!vars) return text;
      return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The standard translate hook: `const { t } = useT(); t("Dashboard")`. */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within an I18nProvider");
  return ctx;
}
