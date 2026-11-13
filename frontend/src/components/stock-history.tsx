"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { InventoryItem, InventoryMovement } from "@/lib/types";

const REASONS: Record<string, TranslationKey> = {
  opening_balance: "Opening balance",
  restock: "restock",
  correction: "correction",
  order_deduction: "sold",
  order_refund: "returned (cancel/refund)",
};

type History = {
  items: InventoryMovement[];
  total: number;
  page: number;
  pageSize: number;
};
const FIELD =
  "rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

export function StockHistory({
  ingredients,
  refreshKey,
}: {
  ingredients: InventoryItem[];
  refreshKey: number;
}) {
  const { t } = useT();
  const [filter, setFilter] = useState({
    inventoryItemId: "",
    direction: "all",
    from: "",
    to: "",
    userId: "",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        direction: filter.direction,
      });
      for (const key of ["inventoryItemId", "from", "to", "userId"] as const)
        if (filter[key]) query.set(key, filter[key]);
      try {
        const result = await api<History>(`/inventory/history?${query}`);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : t("Failed to load inventory"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filter, page, refreshKey, t]);
  function change(key: keyof typeof filter, value: string) {
    setFilter((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  return (
    <section className="space-y-3" aria-busy={loading}>
      <h3 className="text-lg font-semibold text-pos-page-fg">
        {t("Stock history")}
      </h3>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-pos-page-fg">
          {t("All Items")}
          <select
            className={FIELD}
            aria-label={t("All Items")}
            value={filter.inventoryItemId}
            onChange={(e) => change("inventoryItemId", e.target.value)}
          >
            <option value="">{t("All Items")}</option>
            {ingredients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-pos-page-fg">
          {t("All movements")}
          <select
            className={FIELD}
            aria-label={t("All movements")}
            value={filter.direction}
            onChange={(e) => change("direction", e.target.value)}
          >
            <option value="all">{t("All movements")}</option>
            <option value="in">{t("Stock in")}</option>
            <option value="out">{t("Stock out")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-pos-page-fg">
          {t("From date")}
          <input
            className={FIELD}
            type="date"
            value={filter.from}
            max={filter.to || undefined}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-pos-page-fg">
          {t("To date")}
          <input
            className={FIELD}
            type="date"
            value={filter.to}
            min={filter.from || undefined}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-pos-page-fg">
          {t("Staff ID")}
          <input
            className={`${FIELD} w-24`}
            type="number"
            min="1"
            step="1"
            value={filter.userId}
            onChange={(e) => change("userId", e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-pos-page-fg">{t("Loading…")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <table className="w-full text-left text-sm text-stone-900 dark:text-stone-100">
              <thead>
                <tr>
                  {[
                    t("Date"),
                    t("Item Name"),
                    t("Quantity"),
                    t("Balance"),
                    t("Reason / Note"),
                    t("Staff ID"),
                  ].map((label) => (
                    <th key={label} className="px-3 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-stone-100 dark:border-stone-800"
                  >
                    <td className="whitespace-nowrap px-3 py-3">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      {m.inventoryItem?.name ?? `#${m.inventoryItemId}`}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {Number(m.delta) > 0 ? "+" : ""}
                      {Number(m.delta)} {m.inventoryItem?.unit}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {Number(m.stockAfter)} {m.inventoryItem?.unit}
                    </td>
                    <td className="px-3 py-3">
                      {REASONS[m.reason] ? t(REASONS[m.reason]) : m.reason}
                      {m.orderId ? ` · #${m.orderId}` : ""}
                    </td>
                    <td className="px-3 py-3">
                      {m.user?.name ?? "—"}
                      {m.userId ? ` (#${m.userId})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && (
              <p className="p-4 text-sm">{t("No stock movements match.")}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 text-sm text-pos-page-fg">
            <span>
              {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 25))} ·{" "}
              {data?.total ?? 0}
            </span>
            <button
              className={FIELD}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("Previous page")}
            </button>
            <button
              className={FIELD}
              disabled={!data || page * 25 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("Next page")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
