"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function AdminMenuQr() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");

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

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Menu QR Code
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Print or share the public customer menu link.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-[#2A1D15] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3A2A20] print:hidden"
        >
          Print QR
        </button>
      </header>

      <section className="grid gap-6 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:grid-cols-[320px_1fr] dark:border-stone-800 dark:bg-stone-900">
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
