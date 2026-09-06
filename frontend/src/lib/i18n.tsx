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
  // Dashboard
  "Hi": "សួស្តី",
  "there": "អ្នកទាំងអស់គ្នា",
  "Admin command center for today's cafe operations.": "មជ្ឈមណ្ឌលគ្រប់គ្រងសម្រាប់ប្រតិបត្តិការហាងកាហ្វេថ្ងៃនេះ។",
  "Failed to load data": "បរាជ័យក្នុងការផ្ទុកទិន្នន័យ",
  "Revenue": "ចំណូល",
  "Total Orders": "ការបញ្ជាទិញសរុប",
  "Active Orders": "ការបញ្ជាទិញកំពុងដំណើរការ",
  "This Week": "សប្តាហ៍នេះ",
  "Last Week": "សប្តាហ៍មុន",
  "This Month": "ខែនេះ",
  "Last Month": "ខែមុន",
  "This Year": "ឆ្នាំនេះ",
  "Last Year": "ឆ្នាំមុន",
  "All Time": "គ្រប់ពេល",
  "Bar": "របារ",
  "Line": "បន្ទាត់",
  "Area": "ផ្ទៃ",
  "Chart type": "ប្រភេទក្រាហ្វ",
  "total": "សរុប",
  "No revenue in this period.": "គ្មានចំណូលក្នុងរយៈពេលនេះទេ។",
  "Order Status": "ស្ថានភាពការបញ្ជាទិញ",
  "All orders": "ការបញ្ជាទិញទាំងអស់",
  "Pending": "រង់ចាំ",
  "Preparing": "កំពុងរៀបចំ",
  "Ready": "រួចរាល់",
  "Completed": "បានបញ្ចប់",
  "Cancelled": "បានលុបចោល",
  "No orders yet.": "មិនទាន់មានការបញ្ជាទិញទេ។",
  "Popular Categories": "ប្រភេទពេញនិយម",
  "Items sold by category (paid orders)": "ទំនិញលក់តាមប្រភេទ (ការបញ្ជាទិញបានបង់ប្រាក់)",
  "sold": "បានលក់",
  "No paid sales yet.": "មិនទាន់មានការលក់បានបង់ប្រាក់ទេ។",
  "Most popular": "ពេញនិយមបំផុត",
  "Recent Orders": "ការបញ្ជាទិញថ្មីៗ",
  "Order": "ការបញ្ជាទិញ",
  "Items": "ទំនិញ",
  "Total": "សរុប",
  "Status": "ស្ថានភាព",
  "Time": "ម៉ោង",
  // Date tokens (browsers often ship no Khmer locale data, so Intl falls
  // back to English — these let the date helpers below translate anyway).
  "Sun": "អាទិត្យ",
  "Mon": "ចន្ទ",
  "Tue": "អង្គារ",
  "Wed": "ពុធ",
  "Thu": "ព្រហ",
  "Fri": "សុក្រ",
  "Sat": "សៅរ៍",
  "Jan": "មករា",
  "Feb": "កុម្ភៈ",
  "Mar": "មីនា",
  "Apr": "មេសា",
  "May": "ឧសភា",
  "Jun": "មិថុនា",
  "Jul": "កក្កដា",
  "Aug": "សីហា",
  "Sep": "កញ្ញា",
  "Oct": "តុលា",
  "Nov": "វិច្ឆិកា",
  "Dec": "ធ្នូ",
  "AM": "ព្រឹក",
  "PM": "ល្ងាច",
} as const;

export type TranslationKey = keyof typeof km;

export type Translate = (key: TranslationKey) => string;

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
