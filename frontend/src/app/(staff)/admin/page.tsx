"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { OrderStatus, type Order, type Product } from "@/lib/types";

const ACCENT = "#7C5CFC";

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  [OrderStatus.PENDING]: { label: "Pending", color: "#F59E0B" },
  [OrderStatus.PREPARING]: { label: "Preparing", color: "#3B82F6" },
  [OrderStatus.READY]: { label: "Ready", color: "#7C5CFC" },
  [OrderStatus.COMPLETED]: { label: "Completed", color: "#22C55E" },
  [OrderStatus.CANCELLED]: { label: "Cancelled", color: "#A8A29E" },
};

const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Dashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, p] = await Promise.all([
          api<Order[]>("/orders"),
          api<Product[]>("/products"),
        ]);
        if (!cancelled) {
          setOrders(o);
          setProducts(p);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === OrderStatus.COMPLETED);
    const revenue = completed.reduce((s, o) => s + Number(o.total), 0);
    const active = orders.filter(
      (o) =>
        o.status !== OrderStatus.COMPLETED &&
        o.status !== OrderStatus.CANCELLED,
    ).length;
    return {
      revenue,
      total: orders.length,
      active,
      products: products.length,
    };
  }, [orders, products]);

  // Revenue for the last 7 days (from completed + non-cancelled orders).
  const daily = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toDateString();
      const value = orders
        .filter(
          (o) =>
            o.status !== OrderStatus.CANCELLED &&
            new Date(o.createdAt).toDateString() === key,
        )
        .reduce((s, o) => s + Number(o.total), 0);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        value,
      });
    }
    return days;
  }, [orders]);
  const maxDaily = Math.max(1, ...daily.map((d) => d.value));

  // Order status breakdown for the donut.
  const breakdown = useMemo(() => {
    const counts = Object.values(OrderStatus).map((status) => ({
      status,
      ...STATUS_META[status],
      count: orders.filter((o) => o.status === status).length,
    }));
    return counts.filter((c) => c.count > 0);
  }, [orders]);
  const totalForDonut = breakdown.reduce((s, b) => s + b.count, 0) || 1;

  const recent = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [orders],
  );

  // Build the conic-gradient stops for the donut.
  const donutGradient = useMemo(() => {
    let acc = 0;
    const stops = breakdown.map((b) => {
      const start = (acc / totalForDonut) * 360;
      acc += b.count;
      const end = (acc / totalForDonut) * 360;
      return `${b.color} ${start}deg ${end}deg`;
    });
    return stops.length
      ? `conic-gradient(${stops.join(", ")})`
      : "conic-gradient(#E7E5E4 0deg 360deg)";
  }, [breakdown, totalForDonut]);

  return (
    <div className="font-ios mx-auto max-w-7xl">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Hi, {user?.name ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Here&apos;s how your cafe is doing so far.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(stats.revenue)}
          tone="#22C55E"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          loading={loading}
        />
        <StatCard
          label="Total Orders"
          value={String(stats.total)}
          tone={ACCENT}
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
              <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="M13 3v5h5" />
            </svg>
          }
          loading={loading}
        />
        <StatCard
          label="Active Orders"
          value={String(stats.active)}
          tone="#F59E0B"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
          loading={loading}
        />
        <StatCard
          label="Products"
          value={String(stats.products)}
          tone="#3B82F6"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
              <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
              <path d="m4 7 8 4 8-4M12 11v10" />
            </svg>
          }
          loading={loading}
        />
      </div>

      {/* Chart + donut */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Revenue bar chart */}
        <Card className="lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-stone-900">Revenue</h2>
              <p className="text-sm text-stone-400">Last 7 days</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
              {formatPrice(daily.reduce((s, d) => s + d.value, 0))} total
            </span>
          </div>
          <div className="flex h-48 items-end justify-between gap-3">
            {daily.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${(d.value / maxDaily) * 100}%`,
                      minHeight: d.value > 0 ? "6px" : "2px",
                      background:
                        i === daily.length - 1
                          ? ACCENT
                          : `${ACCENT}55`,
                    }}
                    title={formatPrice(d.value)}
                  />
                </div>
                <span className="text-xs text-stone-400">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Status donut */}
        <Card>
          <h2 className="mb-1 font-semibold text-stone-900">Order Status</h2>
          <p className="text-sm text-stone-400">All orders</p>
          <div className="mt-4 flex items-center justify-center">
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full"
              style={{ background: donutGradient }}
            >
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center">
                <div>
                  <p className="text-2xl font-bold text-stone-900">
                    {orders.length}
                  </p>
                  <p className="text-xs text-stone-400">Orders</p>
                </div>
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-2">
            {breakdown.map((b) => (
              <li
                key={b.status}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-stone-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: b.color }}
                  />
                  {b.label}
                </span>
                <span className="font-medium text-stone-900">{b.count}</span>
              </li>
            ))}
            {breakdown.length === 0 && (
              <li className="text-sm text-stone-400">No orders yet.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-3 font-medium">Order</th>
                <th className="pb-3 font-medium">Items</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recent.map((o) => {
                const meta = STATUS_META[o.status];
                const count = o.items.reduce((s, it) => s + it.quantity, 0);
                return (
                  <tr key={o.id} className="text-stone-700">
                    <td className="py-3 font-mono font-medium text-stone-900">
                      {o.orderNumber}
                    </td>
                    <td className="py-3">{count}</td>
                    <td className="py-3 font-medium">
                      {formatPrice(o.total)}
                    </td>
                    <td className="py-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          color: meta.color,
                          background: `${meta.color}1A`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 text-stone-400">
                      {new Date(o.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-400">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  loading,
}: {
  label: string;
  value: string;
  tone: string;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <span
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ color: tone, background: `${tone}1A` }}
      >
        {icon}
      </span>
      <p className="mt-4 text-2xl font-bold tracking-tight text-stone-900">
        {loading ? "…" : value}
      </p>
      <p className="mt-0.5 text-sm text-stone-400">{label}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <Dashboard />;
}
