"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusDropdown } from "@/components/status-dropdown";
import { StatusTabs } from "@/components/status-tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  formatMonthShort,
  formatTimeShort,
  useT,
  type Translate,
  type TranslationKey,
} from "@/lib/i18n";
import { STATUS_FILTERS } from "@/lib/orders";
import {
  OrderStatus,
  PaymentStatus,
  Role,
  type OrderWithUser,
} from "@/lib/types";
import { GLASS } from "@/lib/ui";

// Small Paid / Unpaid / Refunded pill shown next to each order number.
// Labels are translation keys — render them through `t()`.
const PAYMENT_BADGE: Record<PaymentStatus, { label: TranslationKey; cls: string }> = {
  [PaymentStatus.PAID]: {
    label: "Paid",
    cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  },
  [PaymentStatus.UNPAID]: {
    label: "Unpaid",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  [PaymentStatus.REFUNDED]: {
    label: "Refunded",
    cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
};

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useT();
  const meta = PAYMENT_BADGE[status] ?? PAYMENT_BADGE[PaymentStatus.UNPAID];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      {t(meta.label)}
    </span>
  );
}

// "6 Sep 2026, 2:10 PM" with the month and AM/PM translated — the browser's
// toLocaleString() can't do Khmer on most devices.
function formatDateTime(date: Date, t: Translate) {
  return `${date.getDate()} ${formatMonthShort(date, t)} ${date.getFullYear()}, ${formatTimeShort(date, t)}`;
}

/**
 * Full order-history view (filter + list + inline status change). Shared by the
 * cashier `order-history` page and the admin `manage-orders` page — they differ
 * only in their auth/shell wrapper.
 */
export function OrderHistoryView() {
  const { t } = useT();
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [refundTarget, setRefundTarget] = useState<OrderWithUser | null>(null);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    const query = filter === "all" ? "" : `?status=${filter}`;
    return api<OrderWithUser[]>(`/orders${query}`);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const data = await load();
        // Clear any previous failure — otherwise one bad fetch pins the error
        // banner on screen for the rest of the session, through every
        // subsequent filter change that loads perfectly well.
        if (!cancelled) setError(null);
        if (!cancelled) setOrders(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("Failed to load orders"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  async function changeStatus(id: number, status: OrderStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      const updated = await api<OrderWithUser>(`/orders/${id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to update status"));
    } finally {
      setUpdatingId(null);
    }
  }

  async function refund(order: OrderWithUser) {
    setRefunding(true);
    setError(null);
    try {
      const updated = await api<OrderWithUser>(`/orders/${order.id}/refund`, {
        method: "POST",
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      setRefundTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to refund order"));
    } finally {
      setRefunding(false);
    }
  }

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.paymentStatus === PaymentStatus.PAID)
        .reduce((sum, o) => sum + Number(o.total), 0),
    [orders],
  );

  // The shared filter tabs carry English labels; translate them for the bar.
  const filterOptions = useMemo(
    () =>
      STATUS_FILTERS.map((o) => ({
        ...o,
        label: t(o.label),
      })),
    [t],
  );

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">{t("Order History")}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {orders.length === 1
              ? t("1 order")
              : t("{count} orders", { count: orders.length })}
            {filter === "all" && revenue > 0 && (
              <> · {t("${amount} paid revenue", { amount: revenue.toFixed(2) })}</>
            )}
          </p>
        </div>
      </header>

      <div>
        {/* Status filter */}
        <div className="mb-6">
          <StatusTabs
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            label={t("Filter orders by status")}
          />
        </div>

        {error && (
          <p className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("Loading orders…")}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">{t("No orders here yet.")}</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li
                key={order.id}
                className={`rounded-2xl p-5 ${GLASS}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
                      {order.orderNumber}
                      <PaymentBadge status={order.paymentStatus} />
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {formatDateTime(new Date(order.createdAt), t)}
                      {order.user && <> · {order.user.name}</>}
                    </p>
                  </div>
                  <StatusDropdown
                    value={order.status}
                    busy={updatingId === order.id}
                    onChange={(status) => changeStatus(order.id, status)}
                  />
                </div>

                <ul className="mt-4 space-y-1 border-t border-stone-100 dark:border-stone-800 pt-3 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-stone-600 dark:text-stone-400">
                      <span className="flex justify-between">
                        <span>
                          {item.quantity}× {item.product?.name ?? `#${item.productId}`}
                          {item.size && (
                            <span className="text-stone-400 dark:text-stone-500"> ({item.size})</span>
                          )}
                        </span>
                        <span>${Number(item.subtotal).toFixed(2)}</span>
                      </span>
                      {item.extras && item.extras.length > 0 && (
                        <span className="block text-xs text-stone-500 dark:text-stone-400">
                          + {item.extras.map((e) => `${e.name} ${e.quantity} ${e.unit}`).join(", ")}
                        </span>
                      )}
                      {item.note && (
                        <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                          ✎ {item.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-3 font-semibold text-stone-900 dark:text-stone-100">
                  <span>{t("Total")}</span>
                  <span className="flex items-center gap-3">
                    ${Number(order.total).toFixed(2)}
                    {isAdmin &&
                      order.paymentStatus === PaymentStatus.PAID && (
                        <button
                          type="button"
                          onClick={() => setRefundTarget(order)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          {t("Refund")}
                        </button>
                      )}
                    <Link
                      href={`/receipt?orderId=${order.id}`}
                      title={t("Print receipt")}
                      className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                    >
                      🖨 {t("Receipt")}
                    </Link>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {refundTarget && (
        <ConfirmDialog
          title={t("Refund {order}?", { order: refundTarget.orderNumber })}
          message={t(
            "This returns ${amount} to the customer, cancels the order and restocks its items. This cannot be undone.",
            { amount: Number(refundTarget.total).toFixed(2) },
          )}
          confirmLabel={refunding ? t("Refunding…") : t("Refund order")}
          busy={refunding}
          onCancel={() => setRefundTarget(null)}
          onConfirm={() => void refund(refundTarget)}
        />
      )}
    </main>
  );
}
