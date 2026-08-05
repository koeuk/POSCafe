"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusDropdown } from "@/components/status-dropdown";
import { StatusTabs } from "@/components/status-tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { STATUS_FILTERS } from "@/lib/orders";
import {
  OrderStatus,
  PaymentStatus,
  Role,
  type OrderWithUser,
} from "@/lib/types";
import { GLASS } from "@/lib/ui";

// Small Paid / Unpaid / Refunded pill shown next to each order number.
const PAYMENT_BADGE: Record<PaymentStatus, { label: string; cls: string }> = {
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
  const meta = PAYMENT_BADGE[status] ?? PAYMENT_BADGE[PaymentStatus.UNPAID];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/**
 * Full order-history view (filter + list + inline status change). Shared by the
 * cashier `order-history` page and the admin `manage-orders` page — they differ
 * only in their auth/shell wrapper.
 */
export function OrderHistoryView() {
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
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

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
      setError(err instanceof Error ? err.message : "Failed to update status");
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
      setError(err instanceof Error ? err.message : "Failed to refund order");
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

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Order History</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {orders.length} order{orders.length === 1 ? "" : "s"}
            {filter === "all" && revenue > 0 && (
              <> · ${revenue.toFixed(2)} paid revenue</>
            )}
          </p>
        </div>
      </header>

      <div>
        {/* Status filter */}
        <div className="mb-6">
          <StatusTabs
            options={STATUS_FILTERS}
            value={filter}
            onChange={setFilter}
            label="Filter orders by status"
          />
        </div>

        {error && (
          <p className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">No orders here yet.</p>
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
                      {new Date(order.createdAt).toLocaleString()}
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
                    <li
                      key={item.id}
                      className="flex justify-between text-stone-600 dark:text-stone-400"
                    >
                      <span>
                        {item.quantity}× {item.product?.name ?? `#${item.productId}`}
                      </span>
                      <span>${Number(item.subtotal).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-3 font-semibold text-stone-900 dark:text-stone-100">
                  <span>Total</span>
                  <span className="flex items-center gap-3">
                    ${Number(order.total).toFixed(2)}
                    {isAdmin &&
                      order.paymentStatus === PaymentStatus.PAID && (
                        <button
                          type="button"
                          onClick={() => setRefundTarget(order)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          Refund
                        </button>
                      )}
                    <Link
                      href={`/receipt?orderId=${order.id}`}
                      title="Print receipt"
                      className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                    >
                      🖨 Receipt
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
          title={`Refund ${refundTarget.orderNumber}?`}
          message={`This returns $${Number(refundTarget.total).toFixed(
            2,
          )} to the customer, cancels the order and restocks its items. This cannot be undone.`}
          confirmLabel={refunding ? "Refunding…" : "Refund order"}
          busy={refunding}
          onCancel={() => setRefundTarget(null)}
          onConfirm={() => void refund(refundTarget)}
        />
      )}
    </main>
  );
}
