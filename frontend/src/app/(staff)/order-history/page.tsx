"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api";
import { OrderStatus, Role, type Order } from "@/lib/types";

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
        <Link
          href="/dashboard"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          ← Dashboard
        </Link>
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
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                    >
                      {order.status}
                    </span>
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        changeStatus(order.id, e.target.value as OrderStatus)
                      }
                      className="rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-700 outline-none focus:border-[#2A1D15] disabled:opacity-50"
                    >
                      {Object.values(OrderStatus).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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

export default function AdminOrdersPage() {
  return (
    <RequireAuth role={Role.ADMIN}>
      <OrderHistory />
    </RequireAuth>
  );
}
