"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useBranding } from "@/lib/branding-context";
import { GLASS } from "@/lib/ui";
import type { StaticKhqr } from "@/lib/types";

/**
 * The shop's reusable KHQR, sized for printing and standing on the counter.
 * Unlike the pay screen's code this one carries no amount and never expires,
 * so the customer enters the amount in their banking app.
 */
export function PaymentQr() {
  const { appName, khqrEnabled } = useBranding();
  const [data, setData] = useState<StaticKhqr | null>(null);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await api<StaticKhqr>("/payments/khqr/static");
        const url = await QRCode.toDataURL(payload.qr, {
          width: 360,
          margin: 2,
        });
        if (!cancelled) {
          setData(payload);
          setImage(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not build the QR code",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render at high resolution so the printed/downloaded code stays sharp.
  async function handleDownload() {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await QRCode.toDataURL(data.qr, {
        width: 1024,
        margin: 2,
      });
      const slug =
        appName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shop";
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${slug}-payment-khqr.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      {/* Print: only the poster below, centred on a clean page. */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          .qr-chrome { display: none !important; }
          .qr-poster {
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            margin: 0 auto !important;
          }
        }
      `}</style>

      <header
        className={`qr-chrome mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Payment QR (KHQR)
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Print this and stand it on the counter — customers scan and enter
            the amount themselves.
          </p>
        </div>
        {data && (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              {downloading ? "Preparing…" : "Download PNG"}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-pos-button px-4 py-2 text-sm font-medium text-pos-button-fg transition hover:brightness-110"
            >
              Print poster
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <p className="qr-chrome text-sm text-stone-500 dark:text-stone-400">
          Generating…
        </p>
      ) : error || !khqrEnabled ? (
        <div className={`qr-chrome rounded-2xl p-6 ${GLASS}`}>
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {khqrEnabled
              ? error
              : "QR payment isn't set up yet — add your Bakong account in Settings to generate a payment QR."}
          </p>
        </div>
      ) : (
        data && (
          <>
            {/* The poster itself — this is what prints. */}
            <section className="qr-poster mx-auto max-w-md rounded-2xl border border-stone-200/70 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <p className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {data.merchantName}
              </p>
              <p className="mt-1 text-sm font-medium uppercase tracking-widest text-stone-500 dark:text-stone-400">
                Scan to pay · KHQR
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="Shop payment QR code"
                className="mx-auto mt-5 h-72 w-72 rounded-xl bg-white"
              />
              <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
                Scan with any Cambodian banking app, then enter the amount.
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                {data.merchantCity}
              </p>
            </section>

            <p className="qr-chrome mx-auto mt-4 max-w-md text-center text-xs text-stone-400 dark:text-stone-500">
              This code carries no amount and never expires. For a code with the
              amount already filled in, use the QR tab on the Payments screen.
            </p>
          </>
        )
      )}
    </main>
  );
}
