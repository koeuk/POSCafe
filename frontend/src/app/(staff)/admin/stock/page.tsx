"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api";
import { sizeStock, totalStock } from "@/lib/pricing";
import { Role, type Product, type Size } from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-[#2A1D15] focus:ring-2 focus:ring-[#2A1D15]/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [outOnly, setOutOnly] = useState(false);

  const loadProducts = useCallback(async () => {
    const data = await api<Product[]>("/products");
    setProducts(data);
  }, []);

  const loadSizes = useCallback(async () => {
    const data = await api<Size[]>("/sizes");
    setSizes(data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadProducts(), loadSizes()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProducts, loadSizes]);

  const summary = useMemo(() => {
    let cups = 0;
    let outProducts = 0;
    let outSizes = 0;
    for (const p of products) {
      cups += totalStock(p);
      if (totalStock(p) <= 0) outProducts += 1;
      if (p.sizes && p.sizes.length > 0) {
        for (const s of p.sizes) {
          if (sizeStock(p, s.size) <= 0) outSizes += 1;
        }
      }
    }
    return { cups, outProducts, outSizes };
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (outOnly) {
        const hasSizes = !!p.sizes && p.sizes.length > 0;
        const anyOut = hasSizes
          ? p.sizes!.some(
              (s) =>
                (p.variants?.find((v) => v.size === s.size)?.stock ?? 0) <= 0,
            )
          : p.stock <= 0;
        if (!anyOut) return false;
      }
      return true;
    });
  }, [products, query, outOnly]);

  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Stock
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Manage cup sizes and how many cups are in stock.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {/* At-a-glance totals */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard
          label="Cups in stock"
          value={summary.cups}
          tone="neutral"
        />
        <SummaryCard
          label="Products out"
          value={summary.outProducts}
          tone={summary.outProducts > 0 ? "danger" : "ok"}
        />
        <SummaryCard
          label="Sizes out"
          value={summary.outSizes}
          tone={summary.outSizes > 0 ? "danger" : "ok"}
        />
      </div>

      {/* Global size catalog */}
      <SizesManager sizes={sizes} onChanged={loadSizes} />

      {/* Per-product quantities */}
      <div className="mb-3 mt-8 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold text-stone-900 dark:text-stone-100">
          Cup stock
        </h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product…"
          className={`${INPUT} w-48`}
        />
        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <input
            type="checkbox"
            checked={outOnly}
            onChange={(e) => setOutOnly(e.target.checked)}
            className="h-4 w-4 accent-[#2A1D15] dark:accent-amber-500"
          />
          Out of stock only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">
          No products match.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <ProductStock key={p.id} product={p} onSaved={loadProducts} />
          ))}
        </ul>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "danger";
}) {
  const valueColor =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "ok"
        ? "text-green-600 dark:text-green-400"
        : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-stone-500 dark:text-stone-400">
        {label}
      </p>
    </div>
  );
}

// ── Global size catalog (Small / Medium / Large) ─────────────────────────

function SizesManager({
  sizes,
  onChanged,
}: {
  sizes: Size[];
  onChanged: () => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await api("/sizes", { method: "POST", body: { name } });
      setNewName("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add size");
    } finally {
      setBusy(false);
    }
  }

  async function rename(size: Size, name: string) {
    if (name.trim() === size.name || !name.trim()) return;
    setError(null);
    try {
      await api(`/sizes/${size.id}`, {
        method: "PATCH",
        body: { name: name.trim() },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename size");
    }
  }

  async function remove(size: Size) {
    if (!window.confirm(`Delete size "${size.name}"?`)) return;
    setError(null);
    try {
      await api(`/sizes/${size.id}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete size");
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">
        Cup sizes
      </h2>
      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
        The size options products can choose from (e.g. Small, Medium, Large).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {sizes.map((s) => (
          <span
            key={s.id}
            className="group flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 py-1 pl-3 pr-1.5 text-sm dark:border-stone-700 dark:bg-stone-800"
          >
            <input
              defaultValue={s.name}
              onBlur={(e) => rename(s, e.target.value)}
              className="w-20 bg-transparent text-stone-800 outline-none dark:text-stone-200"
            />
            <button
              type="button"
              onClick={() => remove(s)}
              aria-label={`Delete ${s.name}`}
              className="grid h-6 w-6 place-items-center rounded-full text-stone-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20"
            >
              ✕
            </button>
          </span>
        ))}
        {sizes.length === 0 && (
          <span className="text-sm text-stone-400 dark:text-stone-500">
            No sizes yet — add one.
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New size (e.g. Large)"
          className={`${INPUT} w-44`}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-[#2A1D15] px-3.5 py-2 text-sm font-semibold text-amber-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500 dark:text-stone-950"
        >
          Add size
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}

// ── Per-product cup quantities (sizes come from the product form) ─────────

interface StockLine {
  key: string;
  size: string | null;
  current: number;
}

function linesFor(product: Product): StockLine[] {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes.map((s) => ({
      key: s.size,
      size: s.size,
      current: product.variants?.find((v) => v.size === s.size)?.stock ?? 0,
    }));
  }
  return [{ key: "__base__", size: null, current: product.stock }];
}

function ProductStock({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => Promise<void>;
}) {
  const lines = useMemo(() => linesFor(product), [product]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.key, String(l.current)])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = lines.some((l) => Number(values[l.key]) !== l.current);

  async function remove() {
    if (
      !window.confirm(
        `Delete "${product.name}"? This removes the product entirely.`,
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      await onSaved(); // product drops off the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  function set(key: string, v: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: v.replace(/[^0-9]/g, "") }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const sized = product.sizes && product.sizes.length > 0;
      const body = sized
        ? {
            sizes: product.sizes!.map((s) => ({
              size: s.size,
              price: s.price,
              stock: Math.max(0, Number(values[s.size] || "0")),
            })),
          }
        : { stock: Math.max(0, Number(values["__base__"] || "0")) };
      await api(`/products/${product.id}`, { method: "PATCH", body });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center gap-3">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-stone-100 text-xl dark:bg-stone-800">
            ☕
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-stone-900 dark:text-stone-100">
            {product.name}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {product.category?.name ?? "Uncategorized"}
          </p>
        </div>
        {(() => {
          // out = sizes sold out; in = total cups across all sizes.
          const out = lines.filter(
            (l) => Number(values[l.key] || "0") <= 0,
          ).length;
          const inCups = lines.reduce(
            (sum, l) => sum + Math.max(0, Number(values[l.key] || "0")),
            0,
          );
          return (
            <span className="hidden items-center gap-1 text-xs font-medium sm:inline-flex">
              <span
                className={
                  out > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-stone-400 dark:text-stone-500"
                }
              >
                out stock {out}
              </span>
              <span className="text-stone-300 dark:text-stone-600">/</span>
              <span
                className={
                  inCups > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-stone-400 dark:text-stone-500"
                }
              >
                in stock {inCups}
              </span>
            </span>
          );
        })()}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/products?edit=${product.id}`}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-[#2A1D15] px-3.5 py-2 text-sm font-semibold text-amber-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500 dark:text-stone-950"
          >
            {saving ? "Saving…" : saved && !dirty ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-stone-100 pt-3 dark:border-stone-800 sm:grid-cols-2">
        {lines.map((l) => {
          const out = Number(values[l.key] || "0") <= 0;
          return (
            <div
              key={l.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 dark:bg-stone-800/50"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${out ? "bg-red-500" : "bg-green-500"}`}
                />
                <span className="font-medium text-stone-700 dark:text-stone-300">
                  {l.size ?? "Stock"}
                </span>
                {out && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    out
                  </span>
                )}
              </span>
              <input
                value={values[l.key]}
                onChange={(e) => set(l.key, e.target.value)}
                inputMode="numeric"
                className={`${INPUT} w-20 text-right`}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </li>
  );
}

export default function AdminStockPage() {
  return (
    <RequireAuth role={Role.ADMIN}>
      <Stock />
    </RequireAuth>
  );
}
