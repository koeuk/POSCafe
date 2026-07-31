"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import { sizeStock, totalStock } from "@/lib/pricing";
import { type Product, type Size, type SizeRow } from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

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
          ? p.sizes!.some((s) => sizeStock(p, s.size) <= 0)
          : p.stock <= 0;
        if (!anyOut) return false;
      }
      return true;
    });
  }, [products, query, outOnly]);

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-pos-page-fg">
          Stock
        </h1>
        <p className="text-sm text-pos-page-fg/60">
          Manage sizes and how many items are in stock.
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
          label="Items in stock"
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
        <h2 className="mr-auto text-lg font-semibold text-pos-page-fg">
          Product stock
        </h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product…"
          className={`${INPUT} w-48`}
        />
        <label className="flex items-center gap-2 text-sm text-pos-page-fg/70">
          <input
            type="checkbox"
            checked={outOnly}
            onChange={(e) => setOutOnly(e.target.checked)}
            className="h-4 w-4 accent-pos-button"
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
            <ProductStock
              key={p.id}
              product={p}
              catalog={sizes}
              onSaved={async () => {
                await Promise.all([loadProducts(), loadSizes()]);
              }}
            />
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
  // "neutral" is the hero card: an opaque deep-green gradient with white text
  // (matching the dashboard/reports revenue cards). ok/danger keep a soft
  // status tint with a coloured value.
  const solid = tone === "neutral";
  const accent = tone === "danger" ? "#EF4444" : "#22C55E";
  const valueColor =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";
  return (
    <div
      className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      style={
        solid
          ? {
              backgroundImage:
                "linear-gradient(135deg, #059669, color-mix(in srgb, #059669 45%, #052e16))",
              borderColor: "color-mix(in srgb, #059669 28%, transparent)",
            }
          : {
              backgroundImage:
                `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, transparent), ` +
                `color-mix(in srgb, ${accent} 2%, transparent))`,
              borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
            }
      }
    >
      <p
        className={`text-2xl font-bold tabular-nums ${
          solid ? "text-white" : valueColor
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-0.5 text-xs font-medium ${
          solid ? "text-white/75" : "text-stone-500 dark:text-stone-400"
        }`}
      >
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
  const [pendingDelete, setPendingDelete] = useState<Size | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  async function remove() {
    const size = pendingDelete;
    if (!size) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/sizes/${size.id}`, { method: "DELETE" });
      await onChanged();
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete size");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">
        Sizes
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
              onClick={() => setPendingDelete(s)}
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
          className="rounded-lg bg-pos-button px-3.5 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add size
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete size"
          message={`Delete size "${pendingDelete.name}"? Products using it will lose that option.`}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={remove}
        />
      )}
    </section>
  );
}

// ── Per-product cup quantities (sizes come from the product form) ─────────

interface StockLine {
  key: string;
  size: string | null;
  current: number;
  // Capacity high-water mark ("count all that we have"); sold = capacity − current.
  capacity: number;
}

function linesFor(product: Product): StockLine[] {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes.map((s) => {
      const variant = product.variants?.find((v) => v.size === s.size);
      const current = variant?.stock ?? 0;
      return {
        key: s.size,
        size: s.size,
        current,
        capacity: variant?.totalStock ?? current,
      };
    });
  }
  return [
    {
      key: "__base__",
      size: null,
      current: product.stock,
      capacity: product.totalStock ?? product.stock,
    },
  ];
}

function ProductStock({
  product,
  catalog,
  onSaved,
}: {
  product: Product;
  catalog: Size[];
  onSaved: () => Promise<void>;
}) {
  const lines = useMemo(() => linesFor(product), [product]);
  const initialStockValues = () =>
    Object.fromEntries(lines.map((l) => [l.key, String(l.current)]));
  const initialSizeValues = () =>
    Object.fromEntries((product.sizes ?? []).map((s) => [s.size, s.size]));
  const initialPriceValues = () =>
    Object.fromEntries(
      (product.sizes ?? []).map((s) => [s.size, String(s.price)]),
    );
  const [values, setValues] = useState<Record<string, string>>(initialStockValues);
  const [sizeValues, setSizeValues] =
    useState<Record<string, string>>(initialSizeValues);
  const [priceValues, setPriceValues] =
    useState<Record<string, string>>(initialPriceValues);
  const [newRows, setNewRows] = useState<SizeRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removedSizes, setRemovedSizes] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  // Reseed every edit buffer from the product as it stands right now.
  //
  // The buffers are useState *initialisers*, so they only run on mount — and
  // each row is keyed by product id, so refetching the list never remounts it.
  // Entering edit mode must therefore re-read the product, or a buffer holding
  // pre-sale numbers stays "dirty" against fresh server stock and saving writes
  // the old figure back, resurrecting cups that have since been sold.
  function resetBuffers() {
    setValues(initialStockValues());
    setSizeValues(initialSizeValues());
    setPriceValues(initialPriceValues());
    setNewRows([]);
    setRemovedSizes(new Set());
  }

  function startEdit() {
    resetBuffers();
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  const activeLines = useMemo(
    () => lines.filter((line) => !line.size || !removedSizes.has(line.size)),
    [lines, removedSizes],
  );

  // Size names already used by the product or by a pending new row.
  const usedSizes = useMemo(
    () =>
      new Set([
        ...(product.sizes ?? [])
          .filter((s) => !removedSizes.has(s.size))
          .map((s) => sizeValues[s.size] ?? s.size),
        ...newRows.map((r) => r.size),
      ]),
    [product.sizes, newRows, removedSizes, sizeValues],
  );

  const dirty =
    activeLines.some((l) => Number(values[l.key]) !== l.current) ||
    (product.sizes ?? []).some(
      (s) =>
        !removedSizes.has(s.size) &&
        ((sizeValues[s.size] ?? s.size) !== s.size ||
          Number(priceValues[s.size] ?? s.price) !== Number(s.price)),
    ) ||
    newRows.length > 0 ||
    removedSizes.size > 0;

  function addRow() {
    const next = catalog.find((s) => !usedSizes.has(s.name));
    setNewRows((rows) => [
      ...rows,
      { size: next?.name ?? "", price: "", stock: "0" },
    ]);
  }

  function updateRow(index: number, patch: Partial<SizeRow>) {
    setNewRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function updateExistingSize(originalSize: string, size: string) {
    setSaved(false);
    setSizeValues((prev) => ({ ...prev, [originalSize]: size }));
  }

  function updateExistingPrice(originalSize: string, price: string) {
    setSaved(false);
    setPriceValues((prev) => ({ ...prev, [originalSize]: price }));
  }

  function removeRow(index: number) {
    setNewRows((rows) => rows.filter((_, i) => i !== index));
  }

  function removeExistingSize(size: string) {
    setSaved(false);
    setRemovedSizes((prev) => {
      const next = new Set(prev);
      next.add(size);
      return next;
    });
  }

  function cancelEdit() {
    resetBuffers();
    setEditing(false);
    setError(null);
    setSaved(false);
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      await onSaved(); // product drops off the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  function set(key: string, v: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: v.replace(/[^0-9]/g, "") }));
  }

  async function save() {
    // Validate any newly-added sizes: need a name and a valid price.
    const added = newRows
      .map((r) => ({
        size: r.size.trim(),
        price: Number(r.price),
        stock: Math.max(0, Number(r.stock || "0")),
      }))
      .filter((r) => r.size);
    const keptSizes = (product.sizes ?? [])
      .filter((s) => !removedSizes.has(s.size))
      .map((s) => ({
        size: (sizeValues[s.size] ?? s.size).trim(),
        price: Number(priceValues[s.size] ?? s.price),
        stock: Math.max(0, Number(values[s.size] || "0")),
      }))
      .filter((s) => s.size);
    const seen = new Set<string>();
    for (const r of [...keptSizes, ...added]) {
      if (!r.price || Number.isNaN(r.price) || r.price < 0) {
        setError(`Enter a valid price for size "${r.size}".`);
        return;
      }
      const key = r.size.toLowerCase();
      if (seen.has(key)) {
        setError(`Size "${r.size}" is selected twice.`);
        return;
      }
      seen.add(key);
    }

    setSaving(true);
    setError(null);
    try {
      // Create any brand-new size names in the global catalog so they show up
      // in the top "Cup sizes" list and other products' pickers.
      const known = new Set(catalog.map((c) => c.name.toLowerCase()));
      const brandNew = [...keptSizes, ...added].filter(
        (r) => !known.has(r.size.toLowerCase()),
      );
      await Promise.all(
        brandNew.map((r) =>
          api("/sizes", { method: "POST", body: { name: r.size } }).catch(
            () => undefined, // ignore if it already exists
          ),
        ),
      );

      const sized = product.sizes && product.sizes.length > 0;
      // Adding a size to an unsized product converts it to a sized product.
      const body =
        sized || added.length > 0
          ? {
              sizes: [
                ...keptSizes.map(({ size, price, stock }) => ({
                  size,
                  price,
                  stock,
                })),
                ...added,
              ],
            }
          : { stock: Math.max(0, Number(values["__base__"] || "0")) };
      await api(`/products/${product.id}`, { method: "PATCH", body });
      // Fold saved sizes into local state so they render cleanly after reload.
      setValues(() => {
        const next = Object.fromEntries(
          keptSizes.map((r) => [r.size, String(r.stock)]),
        );
        for (const r of added) next[r.size] = String(r.stock);
        return next;
      });
      setSizeValues(
        Object.fromEntries(
          [...keptSizes, ...added].map((r) => [r.size, r.size]),
        ),
      );
      setPriceValues(
        Object.fromEntries(
          [...keptSizes, ...added].map((r) => [r.size, String(r.price)]),
        ),
      );
      setNewRows([]);
      setRemovedSizes(new Set());
      setSaved(true);
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
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
          // Totals across every size: sold / capacity, plus cups still in stock.
          const inCups = activeLines.reduce(
            (sum, l) => sum + Math.max(0, Number(values[l.key] || "0")),
            0,
          );
          const capacity = activeLines.reduce(
            (sum, l) => sum + Math.max(l.capacity, Number(values[l.key] || "0")),
            0,
          );
          const sold = Math.max(0, capacity - inCups);
          return (
            <span className="hidden items-center gap-1.5 text-xs font-medium sm:inline-flex">
              <span className="tabular-nums">
                <span className="text-amber-600 dark:text-amber-400">{sold}</span>
                <span className="text-stone-300 dark:text-stone-600"> / </span>
                <span className="text-stone-500 dark:text-stone-400">
                  {capacity}
                </span>
                <span className="text-stone-400 dark:text-stone-500"> sold</span>
              </span>
              <span className="text-stone-300 dark:text-stone-600">·</span>
              <span
                className={
                  inCups > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                in stock {inCups}
              </span>
            </span>
          );
        })()}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-lg bg-pos-button px-3.5 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              {saved ? "Saved ✓" : "Edit"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            aria-label={`Delete ${product.name}`}
            title="Delete product"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-stone-200 text-stone-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:text-stone-500 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {editing && product.sizes && product.sizes.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          {product.sizes
            .filter((size) => !removedSizes.has(size.size))
            .map((size) => {
              const stockLine = lines.find((line) => line.size === size.size);
              const currentStock = values[size.size] ?? String(stockLine?.current ?? 0);
              const selectedSize = sizeValues[size.size] ?? size.size;
              const selectedPrice = priceValues[size.size] ?? String(size.price);
              return (
                <div
                  key={size.size}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50"
                >
                  <input
                    value={selectedSize}
                    onChange={(e) => updateExistingSize(size.size, e.target.value)}
                    list={`sizes-${product.id}`}
                    placeholder="Size name (e.g. XL)"
                    className={`${INPUT} min-w-48 flex-1`}
                  />
                  <datalist id={`sizes-${product.id}`}>
                    {catalog.map((option) => (
                      <option key={option.id} value={option.name} />
                    ))}
                  </datalist>
                  <div className="relative w-24">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                      $
                    </span>
                    <input
                      value={selectedPrice}
                      onChange={(e) =>
                        updateExistingPrice(
                          size.size,
                          e.target.value.replace(/[^0-9.]/g, ""),
                        )
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`${INPUT} w-full pl-5`}
                    />
                  </div>
                  <input
                    value={currentStock}
                    onChange={(e) => set(size.size, e.target.value)}
                    inputMode="numeric"
                    aria-label="Items in stock"
                    className={`${INPUT} w-20 text-right`}
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingSize(size.size)}
                    aria-label={`Remove ${selectedSize || size.size} from ${product.name}`}
                    title="Remove size"
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 border-t border-stone-100 pt-3 dark:border-stone-800 sm:grid-cols-2">
          {activeLines.map((l) => {
            const inCups = Math.max(0, Number(values[l.key] || "0"));
            const out = inCups <= 0;
            // sold / capacity - how many have sold out of everything we ever had.
            const capacity = Math.max(l.capacity, inCups);
            const sold = Math.max(0, capacity - inCups);
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
                  <span className="text-xs font-medium tabular-nums">
                    <span className="text-amber-600 dark:text-amber-400">
                      {sold}
                    </span>
                    <span className="text-stone-300 dark:text-stone-600"> / </span>
                    <span className="text-stone-500 dark:text-stone-400">
                      {capacity}
                    </span>
                  </span>
                </span>
                <input
                  // Outside edit mode always show the server's number: the
                  // buffer is only authoritative while an edit is in progress.
                  value={
                    editing
                      ? (values[l.key] ?? String(l.current))
                      : String(l.current)
                  }
                  onChange={(e) => set(l.key, e.target.value)}
                  inputMode="numeric"
                  disabled={!editing}
                  className={`${INPUT} w-20 text-right disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add new sizes to this product (edit mode only) */}
      {editing && (
        <div className="mt-2 space-y-2">
          {newRows.map((row, index) => {
            // Suggest catalog sizes not already used; typing a new name is fine.
            const options = catalog.filter(
              (s) => s.name === row.size || !usedSizes.has(s.name),
            );
            return (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50"
              >
                <input
                  value={row.size}
                  onChange={(e) => updateRow(index, { size: e.target.value })}
                  list={`sizes-${product.id}`}
                  placeholder="Size name (e.g. XL)"
                  className={`${INPUT} flex-1`}
                />
                <datalist id={`sizes-${product.id}`}>
                  {options.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                <div className="relative w-24">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                    $
                  </span>
                  <input
                    value={row.price}
                    onChange={(e) =>
                      updateRow(index, {
                        price: e.target.value.replace(/[^0-9.]/g, ""),
                      })
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    className={`${INPUT} w-full pl-5`}
                  />
                </div>
                <input
                  value={row.stock}
                  onChange={(e) =>
                    updateRow(index, {
                      stock: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                  inputMode="numeric"
                  aria-label="Items in stock"
                  className={`${INPUT} w-20 text-right`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label="Remove size"
                  className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-pos-button hover:text-pos-button dark:border-stone-700 dark:text-stone-300"
          >
            <span className="text-base leading-none">＋</span>
            Add size
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete "${product.name}"? This permanently removes the product and its stock.`}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={remove}
        />
      )}
    </li>
  );
}

export default function AdminStockPage() {
  return <Stock />;
}
