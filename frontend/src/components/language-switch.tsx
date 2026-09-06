"use client";

import { LOCALES, useT } from "@/lib/i18n";

// Two-way language control: EN / ខ្មែរ. Drop it anywhere a page needs one.
export function LanguageSwitch() {
  const { locale, setLocale } = useT();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-800">
      {LOCALES.map((o) => {
        const active = locale === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLocale(o.value)}
            lang={o.value}
            aria-pressed={active}
            className={`h-7 rounded-full px-2.5 text-xs font-semibold transition ${
              active
                ? "bg-pos-button text-pos-button-fg"
                : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

