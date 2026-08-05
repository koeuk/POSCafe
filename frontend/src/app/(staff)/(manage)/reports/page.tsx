"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-api";
import { formatPrice } from "@/lib/pricing";
import { GLASS } from "@/lib/ui";
import { downloadExcel } from "@/lib/export-excel";
import { useClickOutside } from "@/lib/use-click-outside";
import {
  CHART_TYPES,
  RevenueChart,
  type ChartType,
} from "@/components/revenue-chart";
import { StatusTabs } from "@/components/status-tabs";

// Summary-card tones, matched to the dashboard's KPI cards so the same
// measure wears the same colour on both pages: money green, counts accent.
const REVENUE_TONE = "#22C55E";
const ORDERS_TONE = "var(--pos-button)";

const sw = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function RevenueIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...sw}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13 3v5h5" />
    </svg>
  );
}

type Period = "day" | "week" | "month" | "year" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom range" },
];

// Parse a "YYYY-MM-DD" string as a LOCAL date. `new Date("YYYY-MM-DD")` parses
// as UTC midnight, which then renders as the previous day in negative-UTC
// timezones — this keeps the label on the correct day everywhere.
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "YYYY-MM-DD" key for a local date.
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// How many days the selected period covers, ending today. "This Month"/"This
// Year" are true calendar-to-date windows (1st of month / Jan 1 → today), not
// rolling 30/365-day spans.
function periodDays(period: Period): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return today.getDate();
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
    }
    case "custom":
      // Not used — custom ranges query the API by from/to instead.
      return 7;
  }
}

interface ReportSummary {
  today: { orders: number; revenue: number };
  allTime: { orders: number; revenue: number };
}

interface DailySale {
  date: string;
  orders: number;
  revenue: number;
}

interface BestProduct {
  productId: number;
  name: string;
  quantitySold: number;
  revenue: number;
}

interface DayClose {
  date: string;
  totals: { payments: number; revenue: number };
  byMethod: { method: string; count: number; amount: number }[];
  byCashier: { userId: number; name: string; orders: number; amount: number }[];
  refunds: { count: number; amount: number };
  cashExpected: number;
}

interface StockReport {
  bySize: { size: string; inStock: number; variants: number; outOfStock: number }[];
  // Optional: an older backend build may not send it yet.
  byProduct?: { productId: number; productName: string; inStock: number }[];
  totals: { inStock: number; outOfStock: number };
  outOfStockItems: { productId: number; productName: string; size: string }[];
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [closeDate, setCloseDate] = useState(() => toLocalDateKey(new Date()));
  // Custom range bounds (used when period === "custom"), defaulting to the
  // last 7 days.
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toLocalDateKey(d);
  });
  const [rangeTo, setRangeTo] = useState(() => toLocalDateKey(new Date()));

  const dayCloseFetch = useFetch(
    () => api<DayClose>(`/reports/day-close?date=${closeDate}`),
    [closeDate],
    { fallback: "Failed to load day close" },
  );
  const dayClose = dayCloseFetch.data;

  const periodMeta = PERIODS.find((p) => p.value === period) ?? PERIODS[1];
  const windowDays = useMemo(() => periodDays(period), [period]);

  const customRange = period === "custom" && rangeFrom <= rangeTo;
  const dailyQuery = customRange
    ? `/reports/daily-sales?from=${rangeFrom}&to=${rangeTo}`
    : `/reports/daily-sales?days=${windowDays}`;

  const { data, loading, error } = useFetch(
    async () => {
      const [summary, daily, bestProducts, stock] = await Promise.all([
        api<ReportSummary>("/reports/summary"),
        api<DailySale[]>(dailyQuery),
        api<BestProduct[]>("/reports/best-products?limit=8"),
        api<StockReport>("/reports/stock"),
      ]);
      return { summary, daily, bestProducts, stock };
    },
    [dailyQuery],
    { fallback: "Failed to load reports" },
  );
  const { summary, daily, bestProducts, stock } = data ?? {
    summary: null as ReportSummary | null,
    daily: [] as DailySale[],
    bestProducts: [] as BestProduct[],
    stock: null as StockReport | null,
  };

  // Backend only returns days that had sales; fill in every day of the window
  // (oldest → newest) with zeros so the chart shows a continuous axis instead
  // of collapsing empty days into adjacent bars.
  const sortedDaily = useMemo(() => {
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const out: DailySale[] = [];
    if (customRange) {
      for (
        const d = parseLocalDate(rangeFrom);
        toLocalDateKey(d) <= rangeTo;
        d.setDate(d.getDate() + 1)
      ) {
        const key = toLocalDateKey(d);
        out.push(byDate.get(key) ?? { date: key, orders: 0, revenue: 0 });
      }
      return out;
    }
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = toLocalDateKey(d);
      out.push(byDate.get(key) ?? { date: key, orders: 0, revenue: 0 });
    }
    return out;
  }, [daily, windowDays, customRange, rangeFrom, rangeTo]);
  // The chart owns its geometry; the page owns date formatting.
  const chartPoints = useMemo(
    () =>
      sortedDaily.map((d) => ({
        key: d.date,
        label: parseLocalDate(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: d.revenue,
        note: `${d.orders} ${d.orders === 1 ? "order" : "orders"}`,
      })),
    [sortedDaily],
  );

  const totalWindowRevenue = sortedDaily.reduce((sum, d) => sum + d.revenue, 0);
  const totalWindowOrders = sortedDaily.reduce((sum, d) => sum + d.orders, 0);

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`poscafe-report-${period}-${stamp}`, [
      {
        title: `Summary (${periodMeta.label})`,
        columns: ["Metric", "Value"],
        rows: [
          // Revenue as raw numbers so Excel/Sheets can SUM and sort them
          // numerically (a "$3.50" string sorts lexically and breaks SUM).
          ["Today Revenue", summary?.today.revenue ?? 0],
          ["Today Orders", summary?.today.orders ?? 0],
          ["All-time Revenue", summary?.allTime.revenue ?? 0],
          ["All-time Orders", summary?.allTime.orders ?? 0],
          ["Window Revenue", totalWindowRevenue],
          ["Window Orders", totalWindowOrders],
        ],
      },
      {
        title: `Daily Sales — ${periodMeta.label}`,
        columns: ["Date", "Orders", "Revenue"],
        rows: sortedDaily.map((d) => [d.date, d.orders, d.revenue]),
      },
      {
        title: "Best Products",
        columns: ["Product", "Sold", "Revenue"],
        rows: bestProducts.map((p) => [p.name, p.quantitySold, p.revenue]),
      },
      ...(stock
        ? [
            {
              title: "Stock by Size",
              columns: ["Size", "In stock", "Variants", "Out of stock"],
              rows: stock.bySize.map((s) => [
                s.size,
                s.inStock,
                s.variants,
                s.outOfStock,
              ]),
            },
            {
              title: "Stock by Product",
              columns: ["Product", "In stock", "Status"],
              rows: (stock.byProduct ?? []).map((p) => [
                p.productName,
                p.inStock,
                p.inStock <= 0 ? "Sold out" : "In stock",
              ]),
            },
          ]
        : []),
    ]);
  }

  return (
    <main className="mx-auto max-w-7xl">
      {/* relative z-20: GLASS surfaces below create their own stacking
          contexts (backdrop-blur), so the header must sit above them for the
          period dropdown to overlap the metric cards. */}
      <div className={`relative z-20 mb-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Reports
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Paid order revenue and product performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodDropdown value={period} onChange={setPeriod} />
          {period === "custom" && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={rangeFrom}
                max={rangeTo}
                onChange={(e) => e.target.value && setRangeFrom(e.target.value)}
                aria-label="Range start"
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-900 outline-none transition focus:border-pos-button dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:[color-scheme:dark]"
              />
              <span className="text-sm text-stone-400">–</span>
              <input
                type="date"
                value={rangeTo}
                min={rangeFrom}
                max={toLocalDateKey(new Date())}
                onChange={(e) => e.target.value && setRangeTo(e.target.value)}
                aria-label="Range end"
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-900 outline-none transition focus:border-pos-button dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:[color-scheme:dark]"
              />
            </span>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Tone encodes the measure, not the card: revenue is green, order
            counts wear the brand accent. The 2-column grid then reads as
            "revenue | orders" down the columns and today / all-time across. */}
        <Metric
          label="Today Revenue"
          value={formatPrice(summary?.today.revenue ?? 0)}
          tone="#059669"
          solid
          icon={<RevenueIcon />}
          loading={loading}
        />
        <Metric
          label="Today Orders"
          value={String(summary?.today.orders ?? 0)}
          tone={ORDERS_TONE}
          icon={<OrdersIcon />}
          loading={loading}
        />
        <Metric
          label="All Revenue"
          value={formatPrice(summary?.allTime.revenue ?? 0)}
          tone={REVENUE_TONE}
          icon={<RevenueIcon />}
          loading={loading}
        />
        <Metric
          label="All Orders"
          value={String(summary?.allTime.orders ?? 0)}
          tone={ORDERS_TONE}
          icon={<OrdersIcon />}
          loading={loading}
        />
      </div>

      <section className={`mt-6 rounded-2xl p-5 ${GLASS}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Daily Sales · {periodMeta.label}
            </h2>
            <p className="text-sm text-stone-400 dark:text-stone-500">
              {formatPrice(totalWindowRevenue)} from {totalWindowOrders} orders
            </p>
          </div>
          <StatusTabs
            options={CHART_TYPES}
            value={chartType}
            onChange={setChartType}
            label="Chart type"
          />
        </div>

        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        ) : sortedDaily.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-400 dark:text-stone-500">
            No paid sales yet.
          </p>
        ) : (
          <RevenueChart points={chartPoints} type={chartType} />
        )}
      </section>

      <section className={`mt-6 rounded-2xl p-5 ${GLASS}`}>
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Best Products</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
              <tr>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Sold</th>
                <th className="pb-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3"><span className="block h-4 w-40 animate-pulse rounded bg-stone-100 dark:bg-stone-800" /></td>
                    <td className="py-3"><span className="block h-4 w-12 animate-pulse rounded bg-stone-100 dark:bg-stone-800" /></td>
                    <td className="py-3"><span className="block h-4 w-20 animate-pulse rounded bg-stone-100 dark:bg-stone-800" /></td>
                  </tr>
                ))
              ) : bestProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-stone-400 dark:text-stone-500">
                    No paid product sales yet.
                  </td>
                </tr>
              ) : (
                bestProducts.map((product) => (
                  <tr key={product.productId} className="text-stone-700 dark:text-stone-300">
                    <td className="py-3 font-medium text-stone-900 dark:text-stone-100">{product.name}</td>
                    <td className="py-3">{product.quantitySold}</td>
                    <td className="py-3 font-medium">{formatPrice(product.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cup stock by size */}
      <section className={`mt-6 rounded-2xl p-5 ${GLASS}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            Stock by Size
          </h2>
          {stock && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {stock.totals.inStock} in stock · {stock.totals.outOfStock} out of stock
            </span>
          )}
        </div>

        {!stock ||
        (stock.bySize.length === 0 && (stock.byProduct ?? []).length === 0) ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            No products yet.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stock.bySize.map((s) => (
                <div
                  key={s.size}
                  className="rounded-xl border border-stone-200/70 p-4 dark:border-stone-800"
                >
                  <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                    {s.size}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {s.inStock}
                    <span className="ml-1 text-sm font-normal text-stone-400">
                      items
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                    {s.outOfStock > 0
                      ? `${s.outOfStock} of ${s.variants} out of stock`
                      : `${s.variants} item${s.variants === 1 ? "" : "s"}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Per-product availability: sold-out products first so problems
                surface without scrolling. */}
            {(stock.byProduct ?? []).length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                  Stock by product
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {[...(stock.byProduct ?? [])]
                    .sort(
                      (a, b) =>
                        Number(b.inStock <= 0) - Number(a.inStock <= 0) ||
                        a.productName.localeCompare(b.productName),
                    )
                    .map((p) => {
                      const out = p.inStock <= 0;
                      return (
                        <div
                          key={p.productId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-stone-200/70 px-3 py-2 dark:border-stone-800"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                out ? "bg-red-500" : "bg-green-500"
                              }`}
                            />
                            <span className="truncate text-sm text-stone-700 dark:text-stone-300">
                              {p.productName}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              out
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            }`}
                          >
                            {out ? "Sold out" : `${p.inStock} in stock`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {stock.outOfStockItems.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                  Out of stock sizes
                </p>
                <div className="flex flex-wrap gap-2">
                  {stock.outOfStockItems.map((it) => (
                    <span
                      key={`${it.productId}-${it.size}`}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400"
                    >
                      {it.productName} · {it.size}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* End-of-day close (Z report) */}
      <section className={`mt-6 rounded-2xl p-5 ${GLASS}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">
              Day close
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Money taken on one day, by method and by cashier — count the
              drawer against these numbers at closing.
            </p>
          </div>
          <input
            type="date"
            value={closeDate}
            max={toLocalDateKey(new Date())}
            onChange={(e) => e.target.value && setCloseDate(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-pos-button dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:[color-scheme:dark]"
          />
        </div>

        {dayCloseFetch.loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
        ) : dayCloseFetch.error || !dayClose ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {dayCloseFetch.error ?? "Failed to load day close"}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <DayCloseStat
                label="Revenue"
                value={formatPrice(dayClose.totals.revenue)}
              />
              <DayCloseStat
                label="Payments"
                value={String(dayClose.totals.payments)}
              />
              <DayCloseStat
                label="Cash expected in drawer"
                value={formatPrice(dayClose.cashExpected)}
                highlight
              />
              <DayCloseStat
                label="Refunds issued"
                value={
                  dayClose.refunds.count > 0
                    ? `${dayClose.refunds.count} · ${formatPrice(dayClose.refunds.amount)}`
                    : "None"
                }
                danger={dayClose.refunds.count > 0}
              />
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                  By payment method
                </h3>
                {dayClose.byMethod.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-stone-500">
                    No payments this day.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200/70 dark:divide-stone-800 dark:border-stone-800">
                    {dayClose.byMethod.map((m) => (
                      <li
                        key={m.method}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium capitalize text-stone-700 dark:text-stone-300">
                          {m.method}
                          <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">
                            {m.count} payment{m.count === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                          {formatPrice(m.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                  By cashier
                </h3>
                {dayClose.byCashier.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-stone-500">
                    No payments this day.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200/70 dark:divide-stone-800 dark:border-stone-800">
                    {dayClose.byCashier.map((c) => (
                      <li
                        key={c.userId}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium text-stone-700 dark:text-stone-300">
                          {c.name}
                          <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">
                            {c.orders} order{c.orders === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                          {formatPrice(c.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function DayCloseStat({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        highlight
          ? "border-green-200 bg-green-50/60 dark:border-green-500/30 dark:bg-green-500/10"
          : "border-stone-200/70 dark:border-stone-800"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          danger
            ? "text-red-600 dark:text-red-400"
            : "text-stone-900 dark:text-stone-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
  loading,
  solid = false,
}: {
  label: string;
  value: string;
  tone: string;
  icon: ReactNode;
  loading: boolean;
  /** Fill the card with a deep, saturated gradient of `tone` (white text). */
  solid?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${GLASS}`}
      style={{
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

// Custom period picker — same pattern as the dashboard's dropdown (pill
// trigger + pop-in glass menu with checkmarks) so the two pages feel
// consistent, sized to line up with the Export button beside it.
function PeriodDropdown({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useClickOutside(ref, () => setOpen(false), open, { escape: true });

  const current = PERIODS.find((p) => p.value === value)?.label ?? "Period";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Report period"
        className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700/60"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-stone-400 dark:text-stone-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {current}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Report period"
          className={`absolute right-0 z-20 mt-2 w-44 origin-top-right overflow-hidden rounded-xl p-1 ${GLASS}`}
          style={{ animation: "menu-pop 160ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          {PERIODS.map((p) => {
            const active = p.value === value;
            return (
              <button
                key={p.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(p.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  active
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-700/60 dark:text-stone-100"
                    : "text-stone-600 hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-stone-700/40"
                }`}
              >
                {p.label}
                {active && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-pos-button"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
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
