"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { api } from "@/lib/api";
import { OrderStatus, type Order } from "@/lib/types";

// The orders endpoint joins the cashier; extend locally.
interface OrderWithUser extends Order {
  user?: { id: number; name: string; role: string };
}

const STATUS_FILTERS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: OrderStatus.PENDING },
  { label: "Preparing", value: OrderStatus.PREPARING },
  { label: "Ready", value: OrderStatus.READY },
  { label: "Completed", value: OrderStatus.COMPLETED },
  { label: "Cancelled", value: OrderStatus.CANCELLED },
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "bg-amber-50 text-amber-700",
  [OrderStatus.PREPARING]: "bg-blue-50 text-blue-700",
  [OrderStatus.READY]: "bg-violet-50 text-violet-700",
  [OrderStatus.COMPLETED]: "bg-green-50 text-green-700",
  [OrderStatus.CANCELLED]: "bg-stone-100 text-stone-500",
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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Orders</h1>
          <p className="text-sm text-stone-500">
            {activeCount} active · {orders.length} total · live
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-[#2A1D15] text-white"
                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-stone-400">No orders here yet.</p>
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
                  className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-stone-500">
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

                  <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between text-stone-600"
                      >
                        <span>
                          {item.quantity}× {item.product?.name ?? `#${item.productId}`}
                        </span>
                        <span>${Number(item.subtotal).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                    <span className="font-semibold text-stone-900">
                      Total ${Number(order.total).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      {canCancel && (
                        <button
                          onClick={() =>
                            changeStatus(order.id, OrderStatus.CANCELLED)
                          }
                          disabled={busy}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      {next && (
                        <button
                          onClick={() => changeStatus(order.id, next.status)}
                          disabled={busy}
                          className="rounded-lg bg-[#2A1D15] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#3A2A20] disabled:opacity-50"
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
