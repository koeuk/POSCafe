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

export type Locale = "en" | "km";

const STORAGE_KEY = "poscafe-locale";
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "km", label: "ខ្មែរ" },
];

// The English text is the key, so a component reads `t("Overview")` and the
// English UI needs no dictionary at all. Khmer lists every English string it
// translates; `TranslationKey` is derived from it, so a `t("...")` call with
// text that has no Khmer entry is a compile error.
const km = {
  // Sidebar sections
  "Overview": "ទិដ្ឋភាពរួម",
  "Sales": "ការលក់",
  "Catalog": "កាតាឡុក",
  "Insights": "ការវិភាគ",
  "Customer": "អតិថិជន",
  // Sidebar links
  "Dashboard": "ផ្ទាំងគ្រប់គ្រង",
  "Point of Sale": "ចំណុចលក់",
  "Orders": "ការបញ្ជាទិញ",
  "Payments": "ការទូទាត់",
  "Categories": "ប្រភេទ",
  "Products": "ផលិតផល",
  "Inventory": "ស្តុក",
  "Order History": "ប្រវត្តិការបញ្ជាទិញ",
  "Reports": "របាយការណ៍",
  "View Menu": "មើលម៉ឺនុយ",
  "QR Code": "កូដ QR",
  // Sidebar chrome
  "Collapse sidebar": "បង្រួមរបារចំហៀង",
  "Expand sidebar": "ពង្រីករបារចំហៀង",
  "Open menu": "បើកម៉ឺនុយ",
  "Appearance": "រូបរាង",
  "Language": "ភាសា",
  "Settings": "ការកំណត់",
  "Log out": "ចាកចេញ",
  // Theme
  "Light": "ភ្លឺ",
  "System": "ប្រព័ន្ធ",
  "Dark": "ងងឹត",
  // Roles
  "Admin": "អ្នកគ្រប់គ្រង",
  "Cashier": "អ្នកគិតលុយ",
} as const;

export type TranslationKey = keyof typeof km;

export type Translate = (key: TranslationKey) => string;

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
    (key) => (locale === "en" ? key : (km[key] ?? key)),
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
