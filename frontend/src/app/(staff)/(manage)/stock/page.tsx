"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsumablesManager } from "@/components/consumables-manager";
import { RecipeEditor } from "@/components/recipe-editor";
import { api } from "@/lib/api";
import { isRecipeManaged, sizeStock, totalStock } from "@/lib/pricing";
import type {
  InventoryItem,
  Product,
  Recipe,
  SoldCount,
  StockMode,
  StockMovement,
} from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

const CARD =
  "rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900";

type Tab = "products" | "supplies";
type Filter = "all" | "out" | "count" | "recipe";

/**
 * Inventory: two things, kept apart.
 *  - Products: how each menu item is tracked — a counted stock figure, or
 *    made to order from a recipe — and how many can be sold right now.
 *  - Supplies: the cups, lids, straws and ingredients recipes draw from.
 */
function Inventory() {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [supplies, setSupplies] = useState<InventoryItem[]>([]);
  const [soldByProduct, setSoldByProduct] = useState<Record<number, number>>({});
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const [productList, recipeList, supplyList, sold, moves] =
      await Promise.all([
        api<Product[]>("/products"),
        api<Recipe[]>("/recipes"),
        api<InventoryItem[]>("/inventory"),
        api<SoldCount[]>("/products/sold"),
        api<StockMovement[]>("/products/movements?limit=30"),
      ]);
    setProducts(productList);
    setRecipes(recipeList);
    setSupplies(supplyList);
    setSoldByProduct(Object.fromEntries(sold.map((r) => [r.productId, r.sold])));
    setMovements(moves);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const summary = useMemo(() => {
    let sellable = 0;
    let out = 0;
    let madeToOrder = 0;
    for (const p of products) {
      const units = totalStock(p);
      sellable += units;
      if (units <= 0) out += 1;
      if (isRecipeManaged(p)) madeToOrder += 1;
    }
    return { sellable, out, madeToOrder };
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (filter === "out") return totalStock(p) <= 0;
      if (filter === "count") return !isRecipeManaged(p);
      if (filter === "recipe") return isRecipeManaged(p);
      return true;
    });
  }, [products, query, filter]);

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-pos-page-fg">
            Inventory
          </h1>
          <p className="text-sm text-pos-page-fg/60">
            {tab === "products"
              ? "How each product is tracked and how many can be sold right now."
              : "Cups, lids, straws and ingredients that recipes draw from."}
          </p>
        </div>
        <div className="flex items-center rounded-2xl border border-stone-200 bg-stone-100/70 p-1 dark:border-stone-800 dark:bg-stone-900">
          {(
            [
              { id: "products", label: "☕ Products" },
              { id: "supplies", label: "🥤 Supplies" },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === t.id
                  ? "bg-white text-stone-900 shadow-md dark:bg-stone-800 dark:text-stone-100"
                  : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {tab === "supplies" && <ConsumablesManager />}

      {tab === "products" && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <SummaryCard label="Sellable units" value={summary.sellable} tone="neutral" />
            <SummaryCard
              label="Sold out"
              value={summary.out}
              tone={summary.out > 0 ? "danger" : "ok"}
            />
            <SummaryCard label="Made to order" value={summary.madeToOrder} tone="ok" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold text-pos-page-fg">
              Products
            </h2>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product…"
              className={`${INPUT} w-48`}
            />
            <div className="flex items-center rounded-xl bg-stone-100 p-1 text-xs font-semibold dark:bg-stone-800">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "count", label: "Counted" },
                  { id: "recipe", label: "Made to order" },
                  { id: "out", label: "Sold out" },
                ] as { id: Filter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    filter === f.id
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
                      : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
                <ProductRow
                  key={p.id}
                  product={p}
                  sold={soldByProduct[p.id] ?? 0}
                  recipes={recipes.filter((r) => r.productId === p.id)}
                  supplies={supplies}
                  onChanged={load}
                />
              ))}
            </ul>
          )}

          <MovementsFeed movements={movements} />
        </>
      )}
    </main>
  );
}

// ── One product: its mode, its availability, and the one action it needs ──

function ProductRow({
  product,
  sold,
  recipes,
  supplies,
  onChanged,
}: {
  product: Product;
  sold: number;
  recipes: Recipe[];
  supplies: InventoryItem[];
  onChanged: () => Promise<void>;
}) {
  const madeToOrder = isRecipeManaged(product);
  const units = totalStock(product);
  const sizes = product.variants ?? [];

  const [adjusting, setAdjusting] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [pendingMode, setPendingMode] = useState<StockMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdjust() {
    setDraft(String(product.stock));
    setError(null);
    setAdjusting(true);
  }

  async function saveStock() {
    const next = Math.max(0, Number(draft || "0"));
    setBusy(true);
    setError(null);
    try {
      await api(`/products/${product.id}`, {
        method: "PATCH",
        body: { stock: next },
      });
      setAdjusting(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function switchMode() {
    if (!pendingMode) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/products/${product.id}`, {
        method: "PATCH",
        body: { stockMode: pendingMode },
      });
      setPendingMode(null);
      setAdjusting(false);
      // Straight into the one thing the new mode needs.
      setEditingRecipe(pendingMode === "recipe");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch");
      setPendingMode(null);
    } finally {
      setBusy(false);
    }
  }

  const out = units <= 0;

  return (
    <li className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-stone-900 dark:text-stone-100">
              {product.name}
            </p>
            <ModePill mode={product.stockMode} />
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {product.category?.name ?? "Uncategorized"}
            {sizes.length > 0 && ` · ${sizes.map((s) => s.size).join(" / ")}`}
          </p>
        </div>

        <span className="hidden items-center gap-1.5 text-xs font-medium sm:inline-flex">
          <span className="tabular-nums">
            <span className="text-amber-600 dark:text-amber-400">{sold}</span>
            <span className="text-stone-400 dark:text-stone-500"> sold</span>
          </span>
          <span className="text-stone-300 dark:text-stone-600">·</span>
          <span
            className={`tabular-nums ${
              out ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            }`}
          >
            {madeToOrder ? `${units} can be made` : `${units} in stock`}
          </span>
        </span>

        <div className="flex items-center gap-2">
          {madeToOrder ? (
            <button
              type="button"
              onClick={() => setEditingRecipe((v) => !v)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                editingRecipe
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
            >
              {editingRecipe ? "Close recipe" : "Edit recipe"}
            </button>
          ) : adjusting ? (
            <>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveStock()}
                inputMode="numeric"
                autoFocus
                aria-label={`Stock for ${product.name}`}
                className={`${INPUT} w-24 text-right`}
              />
              <button
                type="button"
                onClick={() => setAdjusting(false)}
                disabled={busy}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveStock}
                disabled={busy || Number(draft || "0") === product.stock}
                className="rounded-lg bg-pos-button px-3.5 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startAdjust}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Adjust stock
            </button>
          )}
          <button
            type="button"
            onClick={() => setPendingMode(madeToOrder ? "count" : "recipe")}
            title={
              madeToOrder
                ? "Track this product by a stock count instead"
                : "Make this product to order from a recipe instead"
            }
            className="rounded-lg px-2 py-2 text-xs font-medium text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            {madeToOrder ? "→ Counted" : "→ Made to order"}
          </button>
        </div>
      </div>

      {/* Availability per size */}
      {madeToOrder && sizes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          {sizes.map((s) => {
            const hasRecipe = recipes.some((r) => r.size === s.size || r.size === null);
            const n = sizeStock(product, s.size);
            return (
              <span
                key={s.size}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  !hasRecipe
                    ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                    : n <= 0
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                }`}
              >
                <span className="font-semibold">{s.size}</span>
                {!hasRecipe ? "no recipe" : `${n} can be made`}
              </span>
            );
          })}
        </div>
      )}
      {madeToOrder && sizes.length === 0 && recipes.length === 0 && (
        <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-red-600 dark:border-stone-800 dark:text-red-400">
          No recipe yet — this product can&apos;t be sold until one is added.
        </p>
      )}

      {madeToOrder && editingRecipe && (
        <RecipeEditor
          product={product}
          recipes={recipes}
          inventoryItems={supplies}
          onSaved={onChanged}
        />
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {pendingMode && (
        <ConfirmDialog
          title={pendingMode === "recipe" ? "Make to order" : "Track by count"}
          message={
            pendingMode === "recipe"
              ? `${product.name} will be made to order: each sale deducts the cups and ingredients in its recipe.` +
                (product.stock > 0
                  ? ` The current count of ${product.stock} will be cleared.`
                  : "")
              : `${product.name} will be tracked by a stock count. Its recipe${
                  recipes.length === 1 ? "" : "s"
                } will be deleted and sales will no longer deduct supplies.`
          }
          confirmLabel={pendingMode === "recipe" ? "Make to order" : "Track by count"}
          busy={busy}
          onCancel={() => setPendingMode(null)}
          onConfirm={switchMode}
        />
      )}
    </li>
  );
}

function ModePill({ mode }: { mode: StockMode }) {
  return mode === "recipe" ? (
    <span
      title="Made to order: each sale deducts the recipe's supplies"
      className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    >
      Made to order
    </span>
  ) : (
    <span
      title="Counted: one stock figure, whatever the size"
      className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300"
    >
      Counted
    </span>
  );
}

// ── Recent manual stock changes (restocks & corrections) ─────────────────

function MovementsFeed({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-pos-page-fg">
        Recent stock changes
      </h2>
      <ul className={`${CARD} overflow-hidden`}>
        {movements.map((m) => {
          const restock = m.delta > 0;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone-100 px-4 py-2.5 text-sm last:border-b-0 dark:border-stone-800"
            >
              <span
                className={`inline-flex w-16 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  restock
                    ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                }`}
              >
                {restock ? `+${m.delta}` : m.delta}
              </span>
              <span className="min-w-0 flex-1 truncate text-stone-700 dark:text-stone-300">
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {m.product?.name ?? `Product #${m.productId}`}
                </span>
                <span className="text-stone-400 dark:text-stone-500">
                  {" "}
                  → {m.stockAfter} in stock
                </span>
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500">
                {m.user?.name ?? "—"} ·{" "}
                {new Date(m.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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
      className={`${CARD} p-4`}
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
      <p className={`text-2xl font-bold tabular-nums ${solid ? "text-white" : valueColor}`}>
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

export default function AdminStockPage() {
  return <Inventory />;
}
