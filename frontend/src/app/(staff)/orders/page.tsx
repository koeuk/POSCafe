"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { api } from "@/lib/api";
import { STATUS_FILTERS } from "@/lib/orders";
import { OrderStatus, type OrderWithUser } from "@/lib/types";
import { GLASS } from "@/lib/ui";

const STATUS_STYLES: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  [OrderStatus.PREPARING]: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  [OrderStatus.READY]: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  [OrderStatus.COMPLETED]: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  [OrderStatus.CANCELLED]: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

// The next step in the fulfilment flow → a one-tap "advance" button.
const NEXT_STEP: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  [OrderStatus.PENDING]: { label: "Start preparing", status: OrderStatus.PREPARING },
  [OrderStatus.PREPARING]: { label: "Mark ready", status: OrderStatus.READY },
  [OrderStatus.READY]: { label: "Complete", status: OrderStatus.COMPLETED },
};

function OrdersQueue() {
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const query = filter === "all" ? "" : `?status=${filter}`;
    return api<OrderWithUser[]>(`/orders${query}`);
  }, [filter]);

  // Load on mount/filter change, then poll every 10s for a live queue.
  useEffect(() => {
    let cancelled = false;

    async function run(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const data = await load();
        if (!cancelled) setError(null);
        if (!cancelled) setOrders(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    void run(true);
    const interval = setInterval(() => run(false), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
      setOrders((prev) =>
        prev
          .map((o) => (o.id === id ? updated : o))
          // The list is server-filtered, so an order that no longer matches the
          // active tab drops out of view — but only that one. Filtering the
          // whole list on the *updated* order's status would clear every other
          // order off the screen, and switching the tab to follow it would move
          // the cashier away from the queue they were working.
          .filter((o) => filter === "all" || o.status === filter),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  const activeCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== OrderStatus.COMPLETED &&
          o.status !== OrderStatus.CANCELLED,
      ).length,
    [orders],
  );

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Orders</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {activeCount} active · {orders.length} total · live
          </p>
        </div>
      </header>

      <section className={`rounded-2xl p-5 ${GLASS}`}>
        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-pos-button text-white"
                  : "border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
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
            {orders.map((order) => {
              const next = NEXT_STEP[order.status];
              const canCancel =
                order.status === OrderStatus.PENDING ||
                order.status === OrderStatus.PREPARING;
              const busy = updatingId === order.id;

              return (
                <li
                  key={order.id}
                  className={`rounded-2xl p-5 ${GLASS}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {new Date(order.createdAt).toLocaleString()}
                        {order.user && <> · {order.user.name}</>}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[order.status]}`}
                    >
                      {order.status}
                    </span>
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

                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-3">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      Total ${Number(order.total).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      {canCancel && (
                        <button
                          onClick={() =>
                            changeStatus(order.id, OrderStatus.CANCELLED)
                          }
                          disabled={busy}
                          className="rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      {next && (
                        <button
                          onClick={() => changeStatus(order.id, next.status)}
                          disabled={busy}
                          className="rounded-lg bg-pos-button px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#3A2A20] disabled:opacity-50"
                        >
                          {busy ? "…" : next.label}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function OrdersPage() {
  // Any authenticated staff member (cashier or admin) can view the queue.
  return (
    <StaffShell>
      <OrdersQueue />
    </StaffShell>
  );
}
