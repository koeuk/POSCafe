"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusDropdown } from "@/components/status-dropdown";
import { api } from "@/lib/api";
import { STATUS_FILTERS } from "@/lib/orders";
import { OrderStatus, PaymentStatus, type OrderWithUser } from "@/lib/types";
import { GLASS } from "@/lib/ui";

// Small Paid / Unpaid pill shown next to each order number.
function PaymentBadge({ status }: { status: PaymentStatus }) {
  const paid = status === PaymentStatus.PAID;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        paid
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      }`}
    >
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

/**
 * Full order-history view (filter + list + inline status change). Shared by the
 * cashier `order-history` page and the admin `manage-orders` page — they differ
 * only in their auth/shell wrapper.
 */
export function OrderHistoryView() {
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.status === OrderStatus.COMPLETED)
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
              <> · ${revenue.toFixed(2)} completed revenue</>
            )}
          </p>
        </div>
      </header>

      <div>
        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-pos-button text-white"
                  : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700"
              }`}
            >
              {f.label}
            </button>
          ))}
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

                <div className="mt-3 flex justify-between border-t border-stone-100 dark:border-stone-800 pt-3 font-semibold text-stone-900 dark:text-stone-100">
                  <span>Total</span>
                  <span>${Number(order.total).toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
