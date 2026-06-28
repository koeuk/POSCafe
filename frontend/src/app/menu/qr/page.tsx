"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { PageGuard } from "@/components/page-guard";
import { RequireAuth } from "@/components/require-auth";
import { StaffFrame } from "@/components/staff-frame";

function MenuQrScreen() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");

  useEffect(() => {
    // Encode the menu URL on whatever host this page is served from,
    // so the same QR works in dev, on the LAN, or in production.
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm print:shadow-none">
        <h1 className="text-2xl font-bold text-stone-900">☕ POSCAFE</h1>
        <p className="mt-1 text-sm text-stone-500">Scan to view our menu</p>

        <div className="my-6 flex justify-center">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Menu QR code"
              className="h-64 w-64 rounded-2xl border border-stone-200"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-400">
              Generating…
            </div>
          )}
        </div>

        <p className="break-all text-xs text-stone-400">{menuUrl}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="mt-6 rounded-lg bg-stone-900 px-6 py-2.5 font-medium text-white transition hover:bg-stone-800 print:hidden"
      >
        Print
      </button>
    </main>
  );
}

export default function MenuQrPage() {
  return (
    <RequireAuth>
      <PageGuard>
        <StaffFrame>
          <MenuQrScreen />
        </StaffFrame>
      </PageGuard>
    </RequireAuth>
  );
}
