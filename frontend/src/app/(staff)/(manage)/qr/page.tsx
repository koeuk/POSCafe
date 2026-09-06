"use client";

import { useState } from "react";
import { AdminMenuQr } from "@/components/admin-menu-qr";
import { PaymentQr } from "@/components/payment-qr";
import { useT, type TranslationKey } from "@/lib/i18n";

type Tab = "menu" | "payment";

const TABS: { key: Tab; label: TranslationKey }[] = [
  { key: "menu", label: "Menu QR" },
  { key: "payment", label: "Payment QR" },
];

export default function QrPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("menu");

  return (
    <div>
      {/* print:hidden — the tab bar shouldn't appear on a printed poster. */}
      <div className="mx-auto mb-4 flex max-w-7xl gap-2 print:hidden">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === item.key
                ? "bg-pos-button text-pos-button-fg"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            }`}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === "menu" ? <AdminMenuQr /> : <PaymentQr />}
    </div>
  );
}
