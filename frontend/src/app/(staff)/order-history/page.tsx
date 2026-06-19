"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { api } from "@/lib/api";
import { OrderStatus, type Order } from "@/lib/types";

// The orders endpoint joins the cashier; extend locally to avoid editing
// the shared types.ts (kept minimal to prevent collisions).
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

function OrderHistory() {
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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Order History</h1>
          <p className="text-sm text-stone-500">
            {orders.length} order{orders.length === 1 ? "" : "s"}
            {filter === "all" && revenue > 0 && (
              <> · ${revenue.toFixed(2)} completed revenue</>
            )}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl">
        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-[#2A1D15] text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
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
            {orders.map((order) => (
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
                  <div className="relative">
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        changeStatus(order.id, e.target.value as OrderStatus)
                      }
                      aria-label="Order status"
                      className={`cursor-pointer appearance-none rounded-full py-1.5 pl-3.5 pr-9 text-xs font-semibold capitalize outline-none ring-1 ring-inset ring-black/5 transition focus:ring-2 focus:ring-[#2A1D15]/30 disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_STYLES[order.status]}`}
                    >
                      {Object.values(OrderStatus).map((s) => (
                        <option key={s} value={s} className="bg-white text-stone-700">
                          {s}
                        </option>
                      ))}
                    </select>
                    {updatingId === order.id ? (
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin opacity-60"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="opacity-25"
                        />
                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </div>
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

                <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 font-semibold text-stone-900">
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

export default function OrderHistoryPage() {
  return (
    <StaffShell>
      <OrderHistory />
    </StaffShell>
  );
}
