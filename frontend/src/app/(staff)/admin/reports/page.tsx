"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/pricing";

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

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [daily, setDaily] = useState<DailySale[]>([]);
  const [bestProducts, setBestProducts] = useState<BestProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextSummary, nextDaily, nextBestProducts] = await Promise.all([
          api<ReportSummary>("/reports/summary"),
          api<DailySale[]>("/reports/daily-sales?days=14"),
          api<BestProduct[]>("/reports/best-products?limit=8"),
        ]);
        if (!cancelled) {
          setSummary(nextSummary);
          setDaily(nextDaily);
          setBestProducts(nextBestProducts);
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
  }, []);

  const sortedDaily = useMemo(
    () =>
      [...daily].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [daily],
  );
  const maxRevenue = Math.max(1, ...sortedDaily.map((d) => d.revenue));
  const totalWindowRevenue = sortedDaily.reduce((sum, d) => sum + d.revenue, 0);
  const totalWindowOrders = sortedDaily.reduce((sum, d) => sum + d.orders, 0);

  return (
    <main className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Reports
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Completed order revenue and product performance.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-500 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800">
          Last 14 days
        </span>
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

      <section className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Daily Sales</h2>
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
                    className="w-full rounded-lg bg-[#2A1D15] transition-all"
                    style={{
                      height: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%`,
                    }}
                    title={`${formatPrice(day.revenue)} · ${day.orders} orders`}
                  />
                </div>
                <div className="text-center leading-tight">
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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

      <section className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
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
    <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
      <p className="text-sm text-stone-400 dark:text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
        {loading ? "..." : value}
      </p>
    </div>
  );
}
