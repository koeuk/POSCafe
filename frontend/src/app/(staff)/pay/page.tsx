"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { PaymentMethod, type Order, type Payment } from "@/lib/types";

const QUICK_CASH = [5, 10, 20, 50];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.CARD]: "Card",
};

function PayScreen() {
  const params = useSearchParams();
  const orderIdParam = params.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [pending, setPending] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState<Payment | null>(null);

  // Load either the selected order (+ its payment status) or the pending list.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setOrder(null);
      setPaid(null);
      setAlreadyPaid(false);
      setMethod(PaymentMethod.CASH);
      setTendered("");
      try {
        if (orderIdParam) {
          const ord = await api<Order>(`/orders/${orderIdParam}`);
          const existing = await api<Payment | null>(
            `/payments/order/${orderIdParam}`,
          );
          if (!cancelled) {
            setOrder(ord);
            // The API client returns `undefined` (not `null`) for an empty
            // body, so use a loose check to catch both "no payment" cases.
            setAlreadyPaid(existing != null);
          }
        } else {
          const list = await api<Order[]>("/orders?unpaid=true");
          if (!cancelled) setPending(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [orderIdParam]);

  const due = order ? Number(order.total) : 0;
  const tenderedNum = Number(tendered || "0");
  const change = useMemo(
    () => Math.round((tenderedNum - due) * 100) / 100,
    [tenderedNum, due],
  );
  const canConfirm =
    !!order &&
    !alreadyPaid &&
    !paid &&
    due >= 0 &&
    (method !== PaymentMethod.CASH || tenderedNum >= due);

  const press = useCallback((key: string) => {
    setTendered((prev) => {
      if (key === "back") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : (prev || "0") + ".";
      // limit to 2 decimal places
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev;
      const next = prev + key;
      return next.replace(/^0+(?=\d)/, ""); // strip leading zeros
    });
  }, []);

  async function confirm() {
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api<Payment>("/payments", {
        method: "POST",
        body: {
          orderId: order.id,
          method,
          ...(method === PaymentMethod.CASH ? { tendered: tenderedNum } : {}),
        },
      });
      setPaid(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  // --- No order selected: show pending orders to pick from ---
  if (!orderIdParam) {
    return (
      <Shell>
        <h1 className="mb-1 text-2xl font-bold text-stone-900 dark:text-stone-100">Take Payment</h1>
        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">Pick an unpaid order</p>
        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
        ) : error ? (
          <ErrorBox>{error}</ErrorBox>
        ) : pending.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">No unpaid orders right now.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/pay?orderId=${o.id}`}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-100"
                >
                  <span>
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {o.orderNumber}
                    </span>
                    <span className="ml-2 text-sm text-stone-500 dark:text-stone-400">
                      {o.items.length} item{o.items.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {formatPrice(o.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    );
  }

  // --- Loading / error for a specific order ---
  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-stone-500 dark:text-stone-400">Loading order…</p>
      </Shell>
    );
  }
  if (error && !order) {
    return (
      <Shell>
        <ErrorBox>{error}</ErrorBox>
        <BackLink />
      </Shell>
    );
  }

  // --- Payment success ---
  if (paid) {
    return (
      <Shell>
        <div className="rounded-2xl bg-green-50 p-8 text-center dark:bg-green-500/15">
          <p className="text-5xl">✅</p>
          <p className="mt-4 text-lg font-semibold text-green-800 dark:text-green-300">
            Payment complete
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            {order?.orderNumber} · {METHOD_LABELS[paid.method]} paid {formatPrice(paid.amount)}
          </p>
          {Number(paid.change) > 0 && (
            <p className="mt-4 rounded-xl bg-white px-4 py-3 text-2xl font-bold text-stone-900 dark:bg-stone-900 dark:text-stone-100">
              Change {formatPrice(paid.change)}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/receipt?orderId=${paid.orderId}`}
            className="rounded-lg border border-stone-300 px-5 py-2.5 font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            🖨 Print receipt
          </Link>
          <Link
            href="/pay"
            className="rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white transition hover:bg-stone-800"
          >
            Next payment
          </Link>
        </div>
      </Shell>
    );
  }

  // --- Already paid ---
  if (alreadyPaid) {
    return (
      <Shell>
        <ErrorBox>This order has already been paid.</ErrorBox>
        <BackLink />
      </Shell>
    );
  }

  // --- Cash pad ---
  return (
    <Shell wide>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Order summary */}
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            {order?.orderNumber}
          </h1>
          <ul className="mt-4 space-y-1 text-sm">
            {order?.items.map((it) => (
              <li key={it.id} className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>
                  {it.quantity}× {it.product?.name ?? `#${it.productId}`}
                </span>
                <span>{formatPrice(it.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-stone-200 pt-3 text-lg font-bold text-stone-900 dark:border-stone-800 dark:text-stone-100">
            <span>Total due</span>
            <span>{formatPrice(due)}</span>
          </div>
          <BackLink />
        </div>

        {/* Payment method */}
        <div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {Object.values(PaymentMethod).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMethod(option)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  method === option
                    ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:bg-stone-800"
                }`}
              >
                {METHOD_LABELS[option]}
              </button>
            ))}
          </div>

          {method === PaymentMethod.CASH ? (
            <>
              <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-right dark:border-stone-800 dark:bg-stone-800/50">
                <p className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
                  Cash received
                </p>
                <p className="text-3xl font-bold text-stone-900 dark:text-stone-100">
                  {formatPrice(tendered === "" ? 0 : tendered)}
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    tenderedNum >= due ? "text-green-600 dark:text-green-400" : "text-stone-400 dark:text-stone-500"
                  }`}
                >
                  Change {formatPrice(change >= 0 ? change : 0)}
                </p>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-2">
                <QuickBtn label="Exact" onClick={() => setTendered(due.toFixed(2))} />
                {QUICK_CASH.map((amt) => (
                  <QuickBtn
                    key={amt}
                    label={`$${amt}`}
                    onClick={() => setTendered(String(amt))}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map(
                  (k) => (
                    <PadBtn key={k} onClick={() => press(k)}>
                      {k === "back" ? "Back" : k}
                    </PadBtn>
                  ),
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-center dark:border-stone-800 dark:bg-stone-800/50">
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                {METHOD_LABELS[method]} payment
              </p>
              <p className="mt-2 text-3xl font-bold text-stone-900 dark:text-stone-100">
                {formatPrice(due)}
              </p>
              <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
                Confirm after the terminal or QR transfer succeeds.
              </p>
            </div>
          )}

          {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}

          <button
            onClick={confirm}
            disabled={!canConfirm || submitting}
            className="mt-4 w-full rounded-lg bg-stone-900 py-3 font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing..."
              : `Confirm ${METHOD_LABELS[method].toLowerCase()} payment · ${formatPrice(due)}`}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div
        className={`mx-auto rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 ${
          wide ? "max-w-3xl" : "max-w-7xl"
        }`}
      >
        {children}
      </div>
    </main>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
      {children}
    </p>
  );
}

function BackLink() {
  return (
    <Link
      href="/pay"
      className="mt-4 inline-block text-sm text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
    >
      ← All unpaid orders
    </Link>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-stone-300 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      {label}
    </button>
  );
}

function PadBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-stone-200 bg-white py-4 text-xl font-semibold text-stone-900 transition hover:bg-stone-100 active:bg-stone-200 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-700"
    >
      {children}
    </button>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-stone-500 dark:text-stone-400">
          Loading…
        </div>
      }
    >
      <PayScreen />
    </Suspense>
  );
}
