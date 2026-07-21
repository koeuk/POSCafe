"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useBranding } from "@/lib/branding-context";
import { GLASS } from "@/lib/ui";

export function AdminMenuQr() {
  const { appName } = useBranding();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/menu`;
    QRCode.toDataURL(url, { width: 360, margin: 2 })
      .then((dataUrl) => {
        setMenuUrl(url);
        setQrDataUrl(dataUrl);
      })
      .catch(() => {
        setMenuUrl(url);
        setQrDataUrl("");
      });
  }, []);

  // Re-render the QR at high resolution (the on-screen preview is only 360px)
  // and save it as a PNG named after the shop.
  async function handleDownload() {
    if (!menuUrl || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await QRCode.toDataURL(menuUrl, {
        width: 1024,
        margin: 2,
      });
      const link = document.createElement("a");
      const slug =
        appName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "menu";
      link.href = dataUrl;
      link.download = `${slug}-menu-qr.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Menu QR Code
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Print or share the public customer menu link.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl || downloading}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {downloading ? "Preparing…" : "Download QR"}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-pos-button px-4 py-2 text-sm font-medium text-pos-button-fg transition hover:brightness-110"
          >
            Print QR
          </button>
        </div>
      </header>

      <section className={`grid gap-6 rounded-2xl p-6 lg:grid-cols-[320px_1fr] ${GLASS}`}>
        <div className="flex justify-center">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Public menu QR code"
              className="h-72 w-72 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-700"
            />
          ) : (
            <div className="grid h-72 w-72 place-items-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-400 dark:border-stone-700 dark:text-stone-500">
              Generating...
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            Customer destination
          </span>
          <p className="mt-4 break-all rounded-xl border border-stone-200/70 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-800 dark:border-stone-800 dark:bg-stone-800/50 dark:text-stone-200">
            {menuUrl || "Preparing link..."}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            This admin page is for staff management only. The QR still opens the
            customer-facing menu experience at <span className="font-medium text-stone-700 dark:text-stone-300">/menu</span>.
          </p>
        </div>
      </section>
    </main>
  );
}
