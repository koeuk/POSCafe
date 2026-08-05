"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { StatusTabs } from "@/components/status-tabs";
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
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      // Follow the order into its new queue so the tab bar reflects the step
      // just taken and the pill slides across to it. Changing the filter also
      // re-runs the loader, which replaces the list with the server-filtered
      // set for that status.
      //
      // "All" is left alone on purpose: it exists to show every order at once,
      // so jumping to a single status there would wipe the rest off screen.
      if (filter !== "all" && status !== filter) setFilter(status);
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
                        {item.note && (
                          <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                            ✎ {item.note}
                          </span>
                        )}
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
                          className="rounded-lg bg-pos-button px-4 py-1.5 text-sm font-medium text-pos-button-fg transition hover:brightness-110 disabled:opacity-50"
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
