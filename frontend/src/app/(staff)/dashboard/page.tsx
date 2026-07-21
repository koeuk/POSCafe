"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-api";
import { useClickOutside } from "@/lib/use-click-outside";
import { formatPrice } from "@/lib/pricing";
import { OrderStatus, type Order, type Product } from "@/lib/types";

import { GLASS } from "@/lib/ui";
import {
  CHART_TYPES,
  RevenueChart,
  type ChartType,
} from "@/components/revenue-chart";
import { StatusTabs } from "@/components/status-tabs";

// The admin-customizable brand accent (globals.css / Settings → Theme colors).
const ACCENT = "var(--pos-button)";
// Revenue chart bars — green, matching the Revenue KPI card.
// BAR is the default; BAR_CURRENT marks today/the current bucket.
const BAR = "#22C55E";
const BAR_CURRENT = "#15803D";

interface CategorySales {
  categoryId: number;
  name: string;
  quantitySold: number;
  orders: number;
  revenue: number;
}

// Palette for the category bars.
const CAT_COLORS = [
  "var(--pos-button)",
  "#F59E0B",
  "#3B82F6",
  "#22C55E",
  "#7C5CFC",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
];

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

type Period =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "all", label: "All Time" },
];

// Monday-based start of the week, at 00:00.
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("this_week");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const { data, loading, error } = useFetch(
    async () => {
      const [orders, products, categories] = await Promise.all([
        api<Order[]>("/orders"),
        api<Product[]>("/products"),
        api<CategorySales[]>("/reports/categories"),
      ]);
      return { orders, products, categories };
    },
    [],
    { fallback: "Failed to load data" },
  );
  const { orders, products, categories } = data ?? {
    orders: [] as Order[],
    products: [] as Product[],
    categories: [] as CategorySales[],
  };

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

  // Revenue per bucket for the selected period — completed orders only.
  // Weeks/months bucket by day; years and "all" bucket by month.
  const chart = useMemo(() => {
    const now = new Date();
    const completed = orders.filter((o) => o.status === OrderStatus.COMPLETED);

    let start: Date;
    let end: Date;
    let grain: "day" | "month";

    switch (period) {
      case "this_week":
        start = startOfWeek(now);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        grain = "day";
        break;
      case "last_week":
        start = startOfWeek(now);
        start.setDate(start.getDate() - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        grain = "day";
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        grain = "day";
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        grain = "day";
        break;
      case "this_year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        grain = "month";
        break;
      case "last_year":
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        grain = "month";
        break;
      default: {
        // all — from the earliest completed order to now, by month.
        const times = completed.map((o) => new Date(o.createdAt).getTime());
        const earliest = times.length
          ? new Date(Math.min(...times))
          : new Date(now.getFullYear(), 0, 1);
        start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        grain = "month";
      }
    }

    const map = new Map<string, number>();
    for (const o of completed) {
      const t = new Date(o.createdAt);
      if (t < start || t > end) continue;
      const key =
        grain === "day" ? t.toDateString() : `${t.getFullYear()}-${t.getMonth()}`;
      map.set(key, (map.get(key) ?? 0) + Number(o.total));
    }

    const buckets: { label: string; value: number; current: boolean }[] = [];
    if (grain === "day") {
      const todayKey = now.toDateString();
      const byDate = period === "this_month" || period === "last_month";
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toDateString();
        buckets.push({
          label: byDate
            ? String(d.getDate())
            : d.toLocaleDateString("en-US", { weekday: "short" }),
          value: map.get(key) ?? 0,
          current: key === todayKey,
        });
      }
    } else {
      const curKey = `${now.getFullYear()}-${now.getMonth()}`;
      const multiYear = start.getFullYear() !== end.getFullYear();
      for (
        const d = new Date(start.getFullYear(), start.getMonth(), 1);
        d <= end;
        d.setMonth(d.getMonth() + 1)
      ) {
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        buckets.push({
          label: d.toLocaleDateString("en-US", {
            month: "short",
            ...(multiYear ? { year: "2-digit" } : {}),
          }),
          value: map.get(key) ?? 0,
          current: key === curKey,
        });
      }
    }

    return {
      buckets,
      total: buckets.reduce((s, b) => s + b.value, 0),
      max: Math.max(1, ...buckets.map((b) => b.value)),
    };
  }, [orders, period]);

  const periodLabel =
    PERIODS.find((p) => p.value === period)?.label ?? "This Week";

  // The chart owns its geometry; the page owns bucketing and labels.
  const chartPoints = useMemo(
    () =>
      chart.buckets.map((b, i) => ({
        key: `${i}-${b.label}`,
        label: b.label,
        value: b.value,
        current: b.current,
      })),
    [chart.buckets],
  );

  // Categories sorted by popularity (quantity sold).
  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => b.quantitySold - a.quantitySold),
    [categories],
  );
  const maxCat = Math.max(1, ...sortedCats.map((c) => c.quantitySold));
  const totalCupsSold = sortedCats.reduce((s, c) => s + c.quantitySold, 0);

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
          tone="#059669"
          solid
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
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Revenue</h2>
              <p className="text-sm text-stone-400 dark:text-stone-500">{periodLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusTabs
                options={CHART_TYPES}
                value={chartType}
                onChange={setChartType}
                label="Chart type"
              />
              <PeriodMenu value={period} onChange={setPeriod} />
              <span className="hidden rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 sm:inline dark:bg-stone-800 dark:text-stone-400">
                {formatPrice(chart.total)} total
              </span>
            </div>
          </div>
          {chart.buckets.length === 0 ? (
            <p className="flex h-48 items-center justify-center text-sm text-stone-400 dark:text-stone-500">
              No revenue in this period.
            </p>
          ) : (
            <RevenueChart
              points={chartPoints}
              type={chartType}
              color={BAR}
              currentColor={BAR_CURRENT}
            />
          )}
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

      {/* Popular categories */}
      <Card className="mt-6" delay={540}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Popular Categories
            </h2>
            <p className="text-sm text-stone-400 dark:text-stone-500">
              Cups sold by category (completed orders)
            </p>
          </div>
          {sortedCats.length > 0 && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {totalCupsSold} sold
            </span>
          )}
        </div>

        {sortedCats.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400 dark:text-stone-500">
            No completed sales yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedCats.map((c, i) => {
              const color = CAT_COLORS[i % CAT_COLORS.length];
              const pct = (c.quantitySold / maxCat) * 100;
              const share = totalCupsSold
                ? Math.round((c.quantitySold / totalCupsSold) * 100)
                : 0;
              return (
                <li key={c.categoryId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-stone-700 dark:text-stone-300">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: color }}
                      />
                      {c.name}
                      {i === 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Most popular
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-stone-500 dark:text-stone-400">
                      {c.quantitySold} · {share}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        width: loading ? "0%" : `${pct}%`,
                        background: color,
                        transitionDelay: `${i * 70}ms`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Recent orders */}
      <Card className="mt-6" delay={620}>
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

function PeriodMenu({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PERIODS.find((p) => p.value === value)?.label ?? "This Week";

  // Close on outside click or Escape.
  useClickOutside(ref, () => setOpen(false), open, { escape: true });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        {current}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          {...sw}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 z-20 mt-2 w-40 origin-top-right overflow-hidden rounded-xl p-1 ${GLASS}`}
          style={{ animation: "menu-pop 160ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          {PERIODS.map((p) => {
            const active = p.value === value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onChange(p.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                  active
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-700/60 dark:text-stone-100"
                    : "text-stone-600 hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-stone-700/40"
                }`}
              >
                {p.label}
                {active && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...sw}>
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
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
  solid = false,
}: {
  label: string;
  value: string;
  tone: string;
  icon: ReactNode;
  loading: boolean;
  index: number;
  /** Fill the card with a deep, saturated gradient of `tone` (white text). */
  solid?: boolean;
}) {
  return (
    <div
      className={`ios-rise rounded-2xl p-5 transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] ${GLASS}`}
      style={{
        animationDelay: `${80 + index * 70}ms`,
        // A background-*image*, not background-color: GLASS owns the colour and
        // the blur, so the tint layers over the frosted surface instead of
        // replacing it. The default wash is translucent so it reads correctly
        // over the light and the dark shell; `solid` swaps it for an opaque
        // deep gradient of the tone (with white text below).
        backgroundImage: solid
          ? `linear-gradient(135deg, ${tone}, color-mix(in srgb, ${tone} 45%, #052e16))`
          : `linear-gradient(135deg, color-mix(in srgb, ${tone} 14%, transparent), ` +
            `color-mix(in srgb, ${tone} 3%, transparent))`,
        borderColor: `color-mix(in srgb, ${tone} 28%, transparent)`,
      }}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-xl"
        // color-mix (instead of hex-alpha concat) so `tone` may also be a
        // CSS variable like var(--pos-button). Kept stronger than the card
        // wash behind it so the chip still reads as its own element.
        style={
          solid
            ? { color: "#ffffff", background: "rgba(255,255,255,0.22)" }
            : {
                color: tone,
                background: `color-mix(in srgb, ${tone} 22%, transparent)`,
              }
        }
      >
        {icon}
      </span>
      <p
        className={`mt-4 text-2xl font-bold tracking-tight ${
          solid ? "text-white" : "text-stone-900 dark:text-stone-100"
        }`}
      >
        {loading ? "…" : value}
      </p>
      <p
        className={`mt-0.5 text-sm ${
          solid ? "text-white/75" : "text-stone-400 dark:text-stone-500"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

export default function StaffDashboardPage() {
  return <Dashboard />;
}
