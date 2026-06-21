"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { RequireAuth } from "@/components/require-auth";
import { api, getToken } from "@/lib/api";
import { OrderStatus, type Order } from "@/lib/types";
import { GLASS } from "@/lib/ui";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

// Columns shown on the board (completed/cancelled drop off).
const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  { status: OrderStatus.PENDING, title: "New", accent: "border-amber-400" },
  { status: OrderStatus.PREPARING, title: "Preparing", accent: "border-blue-400" },
  { status: OrderStatus.READY, title: "Ready", accent: "border-violet-400" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.PENDING]: OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.READY,
  [OrderStatus.READY]: OrderStatus.COMPLETED,
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: "Start preparing",
  [OrderStatus.PREPARING]: "Mark ready",
  [OrderStatus.READY]: "Complete",
};

const ACTIVE = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
]);

function KitchenScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Insert or replace an order; drop it if it's no longer active.
  const upsert = useCallback((order: Order) => {
    setOrders((prev) => {
      const rest = prev.filter((o) => o.id !== order.id);
      return ACTIVE.has(order.status) ? [...rest, order] : rest;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const all = await api<Order[]>("/orders");
        if (!cancelled) {
          setOrders(all.filter((o) => ACTIVE.has(o.status)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitial();

    // Live updates via Socket.IO (authenticated with the JWT).
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() ?? "" },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("order.created", (order: Order) => upsert(order));
    socket.on("order.updated", (order: Order) => upsert(order));

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [upsert]);

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      const updated = await api<Order>(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      upsert(updated); // socket will also broadcast; upsert is idempotent
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>();
    for (const col of COLUMNS) map.set(col.status, []);
    for (const o of orders) map.get(o.status)?.push(o);
    // Oldest first within each column (FIFO).
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return map;
  }, [orders]);

  return (
    <main className="mx-auto max-w-7xl">
      <header className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">👨‍🍳 Kitchen</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              connected
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </header>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className={`rounded-2xl p-4 text-stone-900 dark:text-stone-100 ${GLASS}`}>
        <div className="grid min-h-[640px] grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status) ?? [];
          return (
            <section key={col.status} className="flex min-h-0 flex-col">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-semibold">{col.title}</h2>
                <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {list.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {loading ? (
                  <p className="px-1 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
                ) : list.length === 0 ? (
                  <p className="px-1 text-sm text-stone-400 dark:text-stone-500">—</p>
                ) : (
                  list.map((order) => (
                    <article
                      key={order.id}
                      className={`rounded-xl border border-stone-200 dark:border-stone-800 border-l-4 bg-stone-50 dark:bg-stone-800 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md ${col.accent}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs text-stone-400 dark:text-stone-500">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-stone-600 dark:text-stone-400">
                        {order.items.map((it) => (
                          <li key={it.id}>
                            <span className="font-medium text-stone-900 dark:text-stone-100">
                              {it.quantity}×
                            </span>{" "}
                            {it.product?.name ?? `#${it.productId}`}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => advance(order)}
                        className="mt-4 w-full rounded-lg bg-[#2A1D15] py-2 text-sm font-semibold text-white transition hover:bg-[#3a2a1f]"
                      >
                        {NEXT_LABEL[order.status] ?? "Next"}
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      </section>
    </main>
  );
}

export default function KitchenPage() {
  return (
    <RequireAuth>
      <KitchenScreen />
    </RequireAuth>
  );
}
