"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";
import { GLASS } from "@/lib/ui";
import { downloadExcel } from "@/lib/export-excel";

type Period = "day" | "week" | "month" | "year";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
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

interface StockReport {
  bySize: { size: string; inStock: number; variants: number; outOfStock: number }[];
  totals: { inStock: number; outOfStock: number };
  outOfStockItems: { productId: number; productName: string; size: string }[];
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [daily, setDaily] = useState<DailySale[]>([]);
  const [bestProducts, setBestProducts] = useState<BestProduct[]>([]);
  const [stock, setStock] = useState<StockReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");

  const periodMeta = PERIODS.find((p) => p.value === period) ?? PERIODS[1];
  const windowDays = useMemo(() => periodDays(period), [period]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextSummary, nextDaily, nextBestProducts, nextStock] =
          await Promise.all([
            api<ReportSummary>("/reports/summary"),
            api<DailySale[]>(`/reports/daily-sales?days=${windowDays}`),
            api<BestProduct[]>("/reports/best-products?limit=8"),
            api<StockReport>("/reports/stock"),
          ]);
        if (!cancelled) {
          setSummary(nextSummary);
          setDaily(nextDaily);
          setBestProducts(nextBestProducts);
          setStock(nextStock);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reports");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  // Backend only returns days that had sales; fill in every day of the window
  // (oldest → newest) with zeros so the chart shows a continuous axis instead
  // of collapsing empty days into adjacent bars.
  const sortedDaily = useMemo(() => {
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const out: DailySale[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = toLocalDateKey(d);
      out.push(byDate.get(key) ?? { date: key, orders: 0, revenue: 0 });
    }
    return out;
  }, [daily, windowDays]);
  const maxRevenue = Math.max(1, ...sortedDaily.map((d) => d.revenue));
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
              title: "Cup Stock by Size",
              columns: ["Size", "In stock", "Variants", "Out of stock"],
              rows: stock.bySize.map((s) => [
                s.size,
                s.inStock,
                s.variants,
                s.outOfStock,
              ]),
            },
          ]
        : []),
    ]);
  }

  return (
    <main className="mx-auto max-w-7xl">
      <div className={`mb-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl px-5 py-5 ${GLASS}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Reports
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Completed order revenue and product performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            aria-label="Report period"
            className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 outline-none transition focus:border-[#2A1D15] focus:ring-2 focus:ring-[#2A1D15]/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-amber-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-pos-button dark:text-stone-950"
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
        <Metric label="Today Revenue" value={formatPrice(summary?.today.revenue ?? 0)} loading={loading} />
        <Metric label="Today Orders" value={String(summary?.today.orders ?? 0)} loading={loading} />
        <Metric label="All Revenue" value={formatPrice(summary?.allTime.revenue ?? 0)} loading={loading} />
        <Metric label="All Orders" value={String(summary?.allTime.orders ?? 0)} loading={loading} />
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
        </div>

        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        ) : sortedDaily.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-400 dark:text-stone-500">
            No completed sales yet.
          </p>
        ) : (
          <div className="flex h-64 items-end gap-2 overflow-x-auto pb-1">
            {sortedDaily.map((day) => (
              <div key={day.date} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                <div className="flex h-48 w-full items-end rounded-xl bg-stone-50 px-2 pb-2 dark:bg-stone-800/50">
                  <div
                    className="w-full rounded-lg bg-pos-button transition-all"
                    style={{
                      height: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%`,
                    }}
                    title={`${formatPrice(day.revenue)} · ${day.orders} orders`}
                  />
                </div>
                <div className="text-center leading-tight">
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {parseLocalDate(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[11px] text-stone-400 dark:text-stone-500">
                    {formatPrice(day.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
                    No completed product sales yet.
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
            Cup Stock by Size
          </h2>
          {stock && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {stock.totals.inStock} in stock · {stock.totals.outOfStock} out of stock
            </span>
          )}
        </div>

        {!stock || stock.bySize.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            No sized products yet.
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
                      cups
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

            {stock.outOfStockItems.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                  Out of stock
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
    </main>
  );
}

function Metric({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 ${GLASS}`}>
      <p className="text-sm text-stone-400 dark:text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
        {loading ? "..." : value}
      </p>
    </div>
  );
}
