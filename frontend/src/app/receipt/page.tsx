"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api";
import { useBranding } from "@/lib/branding-context";
import { formatKhr, formatPrice } from "@/lib/pricing";
import { PaymentStatus, type Order, type Payment } from "@/lib/types";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  qr: "QR",
  card: "Card",
};

/**
 * Printable receipt for a single order, sized for an 80mm thermal roll.
 * The on-screen view wraps the paper strip in a normal page with Print/Back
 * controls; `@media print` hides everything but the strip itself.
 */
function ReceiptScreen() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const { appName, logoUrl, khrPerUsd } = useBranding();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Derived, not state: a missing orderId is known at render time.
  const error = fetchError ?? (orderId ? null : "No order selected.");

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const o = await api<Order>(`/orders/${orderId}`);
        // The payment lookup needs the 'payments' grant — a receipt without
        // tendered/change is still useful, so ignore a denied lookup.
        const p = await api<Payment | null>(`/payments/order/${orderId}`).catch(
          () => null,
        );
        if (!cancelled) {
          setOrder(o);
          setPayment(p);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Failed to load order",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 dark:bg-stone-950 print:bg-white print:p-0">
      {/* Print sizing: 80mm roll, no browser margins. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: #fff !important; }
          .receipt-chrome { display: none !important; }
          .receipt-paper {
            width: 72mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 4mm !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="receipt-chrome mx-auto mb-4 flex max-w-xs items-center justify-between">
        <Link
          href="/pay"
          className="text-sm text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          ← Back
        </Link>
        {order && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            🖨 Print
          </button>
        )}
      </div>

      {loading ? (
        <p className="receipt-chrome text-center text-sm text-stone-500 dark:text-stone-400">
          Loading…
        </p>
      ) : error || !order ? (
        <p className="receipt-chrome mx-auto max-w-xs rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error ?? "Order not found."}
        </p>
      ) : (
        <div className="receipt-paper mx-auto w-full max-w-xs rounded-xl border border-stone-200 bg-white p-5 font-mono text-[13px] leading-snug text-stone-900 shadow-sm dark:border-stone-800">
          {/* Header */}
          <div className="text-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={appName}
                className="mx-auto mb-2 h-12 w-12 rounded object-cover"
              />
            ) : (
              <p className="text-2xl">☕</p>
            )}
            <p className="text-base font-bold uppercase tracking-wide">
              {appName}
            </p>
            <p className="mt-1">{order.orderNumber}</p>
            <p>{new Date(order.createdAt).toLocaleString()}</p>
          </div>

          <Divider />

          {/* Items */}
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id}>
                <p className="break-words">
                  {item.product?.name ?? `#${item.productId}`}
                  {item.size ? ` (${item.size})` : ""}
                </p>
                <p className="flex justify-between tabular-nums">
                  <span>
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </span>
                  <span>{formatPrice(item.subtotal)}</span>
                </p>
              </div>
            ))}
          </div>

          <Divider />

          {/* Totals */}
          <p className="flex justify-between text-base font-bold tabular-nums">
            <span>TOTAL</span>
            <span>{formatPrice(order.total)}</span>
          </p>
          <p className="flex justify-between tabular-nums">
            <span>KHR (@{khrPerUsd.toLocaleString("en-US")})</span>
            <span>{formatKhr(order.total, khrPerUsd)}</span>
          </p>
          {payment && (
            <div className="mt-1 space-y-0.5 tabular-nums">
              <p className="flex justify-between">
                <span>{METHOD_LABELS[payment.method] ?? payment.method}</span>
                <span>{formatPrice(payment.tendered)}</span>
              </p>
              {Number(payment.change) > 0 && (
                <p className="flex justify-between">
                  <span>Change</span>
                  <span>{formatPrice(payment.change)}</span>
                </p>
              )}
            </div>
          )}
          {order.paymentStatus !== PaymentStatus.PAID && (
            <p className="mt-1 text-center font-bold uppercase">— Unpaid —</p>
          )}

          <Divider />

          <p className="text-center">Thank you, see you again!</p>
        </div>
      )}
    </main>
  );
}

function Divider() {
  return (
    <p aria-hidden className="my-2 overflow-hidden whitespace-nowrap">
      --------------------------------
    </p>
  );
}

export default function ReceiptPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-stone-500 dark:text-stone-400">
            Loading…
          </div>
        }
      >
        <ReceiptScreen />
      </Suspense>
    </RequireAuth>
  );
}
