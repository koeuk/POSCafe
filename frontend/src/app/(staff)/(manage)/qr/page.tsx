"use client";

import { useState } from "react";
import { AdminMenuQr } from "@/components/admin-menu-qr";
import { PaymentQr } from "@/components/payment-qr";

type Tab = "menu" | "payment";

const TABS: { key: Tab; label: string }[] = [
  { key: "menu", label: "Menu QR" },
  { key: "payment", label: "Payment QR" },
];

export default function QrPage() {
  const [tab, setTab] = useState<Tab>("menu");

  return (
    <div>
      {/* print:hidden — the tab bar shouldn't appear on a printed poster. */}
      <div className="mx-auto mb-4 flex max-w-7xl gap-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-pos-button text-pos-button-fg"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "menu" ? <AdminMenuQr /> : <PaymentQr />}
    </div>
  );
}
