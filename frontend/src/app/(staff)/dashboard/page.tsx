"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { OrderStatus, type Order, type Product } from "@/lib/types";

import { GLASS } from "@/lib/ui";

const ACCENT = "#2A1D15";

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
    <div className="font-ios mx-auto mt-6 max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      {/* Greeting */}
      <div
        className={`ios-rise mb-6 rounded-2xl px-5 py-5 ${GLASS}`}
        style={{ animationDelay: "0ms" }}
      >
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Hi, {user?.name ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Admin command center for today&apos;s cafe operations.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          index={0}
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
          index={1}
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
          index={2}
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
          index={3}
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
        <Card className="lg:col-span-2" delay={360}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Revenue</h2>
              <p className="text-sm text-stone-400 dark:text-stone-500">Last 7 days</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {formatPrice(daily.reduce((s, d) => s + d.value, 0))} total
            </span>
          </div>
          <div className="flex h-48 items-end justify-between gap-3">
            {daily.map((d, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg transition-[height,background] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-90"
                    style={{
                      height: loading ? "2px" : `${(d.value / maxDaily) * 100}%`,
                      minHeight: d.value > 0 ? "6px" : "2px",
                      transitionDelay: `${i * 70}ms`,
                      background:
                        i === daily.length - 1
                          ? ACCENT
                          : `${ACCENT}55`,
                    }}
                    title={formatPrice(d.value)}
                  />
                </div>
                <span className="text-xs text-stone-400 dark:text-stone-500">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Status donut */}
        <Card delay={460}>
          <h2 className="mb-1 font-semibold text-stone-900 dark:text-stone-100">Order Status</h2>
          <p className="text-sm text-stone-400 dark:text-stone-500">All orders</p>
          <div className="mt-4 flex items-center justify-center">
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full transition-transform duration-500 hover:scale-105"
              style={{ background: donutGradient }}
            >
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center dark:bg-stone-900">
                <div>
                  <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {orders.length}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">Orders</p>
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
                <span className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: b.color }}
                  />
                  {b.label}
                </span>
                <span className="font-medium text-stone-900 dark:text-stone-100">{b.count}</span>
              </li>
            ))}
            {breakdown.length === 0 && (
              <li className="text-sm text-stone-400 dark:text-stone-500">No orders yet.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="mt-6" delay={560}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
                <th className="pb-3 font-medium">Order</th>
                <th className="pb-3 font-medium">Items</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {recent.map((o) => {
                const meta = STATUS_META[o.status];
                const count = o.items.reduce((s, it) => s + it.quantity, 0);
                return (
                  <tr
                    key={o.id}
                    className="text-stone-700 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800/40"
                  >
                    <td className="py-3 font-mono font-medium text-stone-900 dark:text-stone-100">
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
                    <td className="py-3 text-stone-400 dark:text-stone-500">
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
                  <td colSpan={5} className="py-8 text-center text-stone-400 dark:text-stone-500">
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
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`ios-rise rounded-2xl p-5 transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] ${GLASS} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
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
  index,
}: {
  label: string;
  value: string;
  tone: string;
  icon: ReactNode;
  loading: boolean;
  index: number;
}) {
  return (
    <div
      className={`ios-rise rounded-2xl p-5 transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] ${GLASS}`}
      style={{ animationDelay: `${80 + index * 70}ms` }}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ color: tone, background: `${tone}1A` }}
      >
        {icon}
      </span>
      <p className="mt-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
        {loading ? "…" : value}
      </p>
      <p className="mt-0.5 text-sm text-stone-400 dark:text-stone-500">{label}</p>
    </div>
  );
}

export default function StaffDashboardPage() {
  return <Dashboard />;
}
