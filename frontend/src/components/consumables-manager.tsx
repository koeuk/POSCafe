"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StockHistory } from "@/components/stock-history";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PopSelect } from "@/components/pop-select";
import { formatPrice } from "@/lib/pricing";
import { api } from "@/lib/api";
import {
  useT,
  type Translate,
  type TranslationKey,
} from "@/lib/i18n";
import {
  type InventoryItem,
  type Recipe,
} from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

// Sentinel option in the unit / group pickers that reveals a free-text input.
const NEW_UNIT = "__new__";
const NEW_GROUP = "__new_group__";
// The three kinds of supplies a café keeps. Anything else can be typed in.
// These are the stored values; `groupLabel` translates them for display.
const SUPPLY_GROUPS: readonly TranslationKey[] = ["Raw Materials", "Packaging", "Operating Supplies"];
const DEFAULT_GROUP: string = SUPPLY_GROUPS[0];
// Common units of measure; anything else can be typed in.
const DEFAULT_UNITS = ["pcs", "g", "kg", "ml", "L"];

/** Display label for a supply group: the standard groups are translated, custom names pass through. */
function groupLabel(name: string, t: Translate): string {
  const standard = SUPPLY_GROUPS.find((g) => g.toLowerCase() === name.toLowerCase());
  return standard ? t(standard) : name;
}

export function ConsumablesManager() {
  const { t } = useT();
  const [archivedItems, setArchivedItems] = useState<InventoryItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState<number | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add/Edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: DEFAULT_GROUP,
    unit: "pcs",
    stockQuantity: "0",
    minThreshold: "10",
    costPerUnit: "0",
    adjustmentReason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Quick Restock modal state
  const [historyVersion, setHistoryVersion] = useState(0);
  const [restockMode, setRestockMode] = useState<"in" | "out" | "adjust">("adjust");
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockDelta, setRestockDelta] = useState("");
  const [restockReason, setRestockReason] = useState("");
  const restockingRef = useRef(false);
  const [restocking, setRestocking] = useState(false);

  // Delete confirm modal
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);
  // Force-delete guard: the user must tick the checkbox when recipes use the item.
  const [forceAck, setForceAck] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemList, recipeList, archivedList] = await Promise.all([
        api<InventoryItem[]>("/inventory"),
        api<Recipe[]>("/recipes"),
        api<InventoryItem[]>("/inventory/archived"),
      ]);
      setItems(itemList);
      setArchivedItems(archivedList);
      setRecipes(recipeList);
      setHistoryVersion(v => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (showArchived ? archivedItems : items).filter((item) => {
      if (
        categoryFilter !== "all" &&
        (item.category || "").toLowerCase() !== categoryFilter.toLowerCase()
      )
        return false;
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = (item.category || "").toLowerCase().includes(q);
        const matchUnit = (item.unit || "").toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchUnit) return false;
      }
      return true;
    });
  }, [items, archivedItems, showArchived, query, categoryFilter]);

  const stockSummary = useMemo(() => ({
    total: items.length,
    low: items.filter(i => Number(i.stockQuantity) > 0 && Number(i.stockQuantity) <= Number(i.minThreshold)).length,
    out: items.filter(i => Number(i.stockQuantity) <= 0).length,
    value: items.reduce((sum, i) => sum + Number(i.stockQuantity) * Number(i.costPerUnit ?? 0), 0),
    uncosted: items.filter(i => Number(i.stockQuantity) > 0 && Number(i.costPerUnit ?? 0) === 0).length,
  }), [items]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => Number(i.stockQuantity) <= Number(i.minThreshold)).length;
  }, [items]);

  // Group names for the filter tabs and the picker: the three standard
  // groups, plus any custom name an existing item carries.
  const categoryNames = useMemo(() => {
    const names: string[] = [...SUPPLY_GROUPS];
    const known = new Set(names.map((n) => n.toLowerCase()));
    for (const item of items) {
      const name = (item.category || "").trim();
      if (name && !known.has(name.toLowerCase())) {
        known.add(name.toLowerCase());
        names.push(name);
      }
    }
    return names;
  }, [items]);

  // Which drinks (and sizes) consume each item — the real link between a
  // consumable and the menu, straight from the recipes.
  const usedIn = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const recipe of recipes) {
      const label = recipe.size
        ? `${recipe.product?.name ?? `#${recipe.productId}`} (${recipe.size})`
        : recipe.product?.name ?? `#${recipe.productId}`;
      for (const line of recipe.items ?? []) {
        const list = map.get(line.inventoryItemId) ?? [];
        list.push(label);
        map.set(line.inventoryItemId, list);
      }
    }
    return map;
  }, [recipes]);

  function openAddModal() {
    setEditingItem(null);
    setFormData({
      name: "",
      category: DEFAULT_GROUP,
      unit: "pcs",
      stockQuantity: "100",
      minThreshold: "20",
      costPerUnit: "0",
      adjustmentReason: "",
    });
    setShowAddModal(true);
  }

  function openEditModal(item: InventoryItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stockQuantity: String(item.stockQuantity),
      minThreshold: String(item.minThreshold),
      costPerUnit: String(item.costPerUnit ?? 0),
      adjustmentReason: "",
    });
    setShowAddModal(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim() || DEFAULT_GROUP,
        unit: formData.unit.trim(),
        ...(!editingItem || Number(formData.stockQuantity) !== Number(editingItem.stockQuantity)
          ? { stockQuantity: Number(formData.stockQuantity) }
          : {}),
        minThreshold: Number(formData.minThreshold) || 0,
        costPerUnit: Number(formData.costPerUnit),
        ...(editingItem ? { adjustmentReason: formData.adjustmentReason.trim() || undefined } : {}),
      };

      if (editingItem) {
        await api(`/inventory/${editingItem.id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await api("/inventory", {
          method: "POST",
          body: payload,
        });
      }
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to save item"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!restockItem) return;
    const entered = Number(restockDelta);
    const delta = restockMode === "out" ? -Math.abs(entered) : restockMode === "in" ? Math.abs(entered) : entered;
    if (!Number.isFinite(delta) || delta === 0 || (restockMode !== "adjust" && entered <= 0)) return;

    if (restockingRef.current) return;
    restockingRef.current = true;
    setRestocking(true);
    setError(null);
    try {
      await api(`/inventory/${restockItem.id}/restock`, {
        method: "POST",
        body: { delta, reason: restockReason.trim() || undefined },
      });
      setRestockItem(null);
      setRestockDelta("");
      setRestockReason("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to restock item"));
    } finally {
      restockingRef.current = false;
      setRestocking(false);
    }
  }

  async function toggleArchive(item: InventoryItem) {
    if (archiveBusy !== null) return;
    setArchiveBusy(item.id); setError(null);
    try {
      await api(`/inventory/${item.id}/${item.archivedAt ? "restore" : "archive"}`, { method: "POST" });
      await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : t("Failed to save item")); }
    finally { setArchiveBusy(null); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      // An item still used by recipes is deleted with force: the backend
      // strips it from those recipes (and drops any recipe left empty).
      const inUse = (usedIn.get(pendingDelete.id) ?? []).length > 0;
      await api(`/inventory/${pendingDelete.id}${inUse ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      setPendingDelete(null);
      await loadData();
    } catch (err) {
      setPendingDelete(null);
      setError(err instanceof Error ? err.message : t("Failed to delete item"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header controls & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-pos-page-fg">
            {t("Consumable Supplies & Raw Ingredients")}
          </h2>
          <p className="text-xs text-pos-page-fg/60">
            {t("Track packaging (cups, lids, straws) and raw materials (coffee beans, milk, syrups).")}
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg shadow-sm transition hover:opacity-90"
        >
          {t("+ Add Consumable Item")}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading}>
        {[
          { label: t("Total stock items"), value: String(stockSummary.total) },
          { label: t("Low stock"), value: String(stockSummary.low) },
          { label: t("Out of stock"), value: String(stockSummary.out) },
          { label: t("Stock value"), value: formatPrice(stockSummary.value) },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <p className="text-sm text-stone-500 dark:text-stone-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{loading ? "…" : card.value}</p>
          </div>
        ))}
      </div>
      {!loading && stockSummary.uncosted > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          {t("{count} stocked items have no unit cost; stock value is incomplete.", { count: stockSummary.uncosted })}
        </p>
      )}

      <button type="button" onClick={() => setShowArchived(value => !value)} aria-pressed={showArchived}
        className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-pos-page-fg dark:border-stone-700">
        {t(showArchived ? "Show active items" : "Show archived items")} ({showArchived ? items.length : archivedItems.length})
      </button>

      {/* Category filter & Search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-900">
          {[
            { id: "all", label: t("All Items") },
            ...categoryNames.map((c) => ({ id: c.toLowerCase(), label: groupLabel(c, t) })),
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                categoryFilter.toLowerCase() === cat.id.toLowerCase()
                  ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
                  : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search items…")}
          className={`${INPUT} w-52`}
        />

        {lowStockCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            ⚠️ {t("{n} items low in stock", { n: lowStockCount })}
          </span>
        )}
      </div>

      {/* Items Table / Cards */}
      {loading ? (
        <p className="text-sm text-stone-500">{t("Loading supplies inventory…")}</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400 dark:border-stone-800">
          {t("No consumable items match your filter.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const currentStock = Number(item.stockQuantity);
            const minThresh = Number(item.minThreshold);
            const isLow = currentStock <= minThresh;

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-md dark:bg-stone-900 ${
                  isLow
                    ? "border-amber-300 dark:border-amber-500/30"
                    : "border-stone-200/70 dark:border-stone-800"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                          {groupLabel(item.category, t)}
                        </span>
                      </div>
                      <h3 className="mt-1 font-semibold text-stone-900 dark:text-stone-100">
                        {item.name}
                      </h3>
                      {(() => {
                        const uses = usedIn.get(item.id) ?? [];
                        return uses.length > 0 ? (
                          <p
                            className="mt-0.5 line-clamp-1 text-[11px] text-stone-500 dark:text-stone-400"
                            title={uses.join(", ")}
                          >
                            📜{" "}
                            {uses.length === 1
                              ? t("Used by {name}", { name: uses[0] })
                              : t("Used by {n} recipes", { n: uses.length })}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                            {t("Not used by any recipe yet")}
                          </p>
                        );
                      })()}
                    </div>
                    {isLow && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-400">
                        {t("Low stock")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
                      {currentStock.toLocaleString()}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {item.unit}
                    </span>
                    <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
                      {t("Min: {n} {unit}", { n: minThresh, unit: item.unit })}
                    </span>
                  </div>
                </div>

                <button type="button" disabled={archiveBusy !== null} onClick={() => void toggleArchive(item)}
                  className="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200">
                  {t(item.archivedAt ? "Restore item" : "Archive item")}
                </button>
                <div className={`mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800 ${item.archivedAt ? "hidden" : ""}`}>
                  <div className="flex flex-wrap gap-1">
                    {(["in", "out", "adjust"] as const).map(mode => <button key={mode} type="button"
                      onClick={() => { setError(null); setRestockMode(mode); setRestockItem(item); setRestockDelta(""); setRestockReason(""); }}
                      className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200">
                      {t(mode === "in" ? "Stock in" : mode === "out" ? "Stock out" : "Adjustment")}
                    </button>)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      title={t("Edit Item")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForceAck(false);
                        setPendingDelete(item);
                      }}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                      title={t("Delete Item")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StockHistory ingredients={[...items, ...archivedItems]} refreshKey={historyVersion} />

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {editingItem ? t("Edit Consumable Item") : t("Add New Consumable Item")}
            </h3>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t("Item Name")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("e.g. Plastic Cup 16oz")}
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t("Group")}
                  </label>
                  {(() => {
                    const counts = new Map<string, number>();
                    for (const i of items) {
                      counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
                    }
                    const custom =
                      formData.category !== "" &&
                      !categoryNames.some(
                        (c) => c.toLowerCase() === formData.category.toLowerCase(),
                      );
                    const options = [
                      ...categoryNames.map((c) => ({
                        value: c,
                        label: groupLabel(c, t),
                        hint: counts.get(c)
                          ? counts.get(c) === 1
                            ? t("{n} item", { n: 1 })
                            : t("{n} items", { n: counts.get(c) ?? 0 })
                          : undefined,
                      })),
                      { value: NEW_GROUP, label: t("Other…"), hint: undefined },
                    ];
                    return (
                      <>
                        <PopSelect
                          ariaLabel={t("Group")}
                          className="mt-1"
                          buttonClassName={INPUT}
                          value={custom ? NEW_GROUP : formData.category}
                          placeholder={t("Select a group")}
                          onChange={(v) =>
                            setFormData({
                              ...formData,
                              category: v === NEW_GROUP ? "" : v,
                            })
                          }
                          options={options}
                        />
                        {(custom || formData.category === "") && (
                          <input
                            value={formData.category}
                            onChange={(e) =>
                              setFormData({ ...formData, category: e.target.value })
                            }
                            placeholder={t("Group name")}
                            aria-label={t("Custom group name")}
                            className={`${INPUT} mt-2 w-full`}
                          />
                        )}
                        <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
                          {t(
                            "Raw materials go into drinks, packaging leaves with the order, operating supplies are used in the shop.",
                          )}
                        </p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t("Unit of measure")}
                  </label>
                  {(() => {
                    const units = [
                      ...new Set([
                        ...DEFAULT_UNITS,
                        ...items.map((i) => i.unit).filter(Boolean),
                      ]),
                    ];
                    const isKnown = units.includes(formData.unit);
                    return (
                      <>
                        <PopSelect
                          ariaLabel={t("Unit of measure")}
                          className="mt-1"
                          buttonClassName={INPUT}
                          value={isKnown ? formData.unit : NEW_UNIT}
                          onChange={(v) =>
                            setFormData({ ...formData, unit: v === NEW_UNIT ? "" : v })
                          }
                          options={[
                            ...units.map((u) => ({ value: u, label: u })),
                            { value: NEW_UNIT, label: t("+ Other unit…") },
                          ]}
                        />
                        {!isKnown && (
                          <input
                            type="text"
                            autoFocus
                            required
                            value={formData.unit}
                            onChange={(e) =>
                              setFormData({ ...formData, unit: e.target.value })
                            }
                            placeholder={t("e.g. box, bottle")}
                            className={`${INPUT} mt-2 w-full`}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t("Initial Stock")}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.stockQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, stockQuantity: e.target.value })
                    }
                    className={`${INPUT} mt-1 w-full`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t("Min Alert Threshold")}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.minThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, minThreshold: e.target.value })
                    }
                    className={`${INPUT} mt-1 w-full`}
                  />
                </div>
              </div>

              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                {t("Unit cost (USD per stock unit)")}
                <input type="number" min="0" step="0.0001" required value={formData.costPerUnit}
                  onChange={e => setFormData({ ...formData, costPerUnit: e.target.value })}
                  className={`${INPUT} mt-1 w-full`} />
              </label>
              {editingItem && Number(formData.stockQuantity) !== Number(editingItem.stockQuantity) && (
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t("Reason / Note")}
                  <input required pattern=".*\S.*" maxLength={100} value={formData.adjustmentReason}
                    onChange={e => setFormData({ ...formData, adjustmentReason: e.target.value })}
                    className={`${INPUT} mt-1 w-full`} />
                </label>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? t("Saving…") : t("Save Item")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {t(restockMode === "in" ? "Stock in" : restockMode === "out" ? "Stock out" : "Adjustment")} · {restockItem.name}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {t("Current stock: {n} {unit}", {
                n: Number(restockItem.stockQuantity).toLocaleString(),
                unit: restockItem.unit,
              })}
            </p>

            <form onSubmit={handleRestock} className="mt-4 space-y-4">
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t(restockMode === "adjust" ? "Quantity Adjustment (+ to add, - to subtract)" : "Quantity")}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min={restockMode === "adjust" ? undefined : "0.001"}
                  value={restockDelta}
                  onChange={(e) => setRestockDelta(e.target.value)}
                  placeholder={t("e.g. +100 or -10")}
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t("Reason / Note")}
                </label>
                <input
                  type="text"
                  required
                  pattern=".*\S.*"
                  maxLength={100}
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder={t("e.g. Restock, Spoilage, Correction")}
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={restocking}
                  className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:opacity-40"
                >
                  {restocking ? t("Saving…") : t("Confirm Adjustment")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {pendingDelete && (
        (() => {
          const uses = usedIn.get(pendingDelete.id) ?? [];
          const inUse = uses.length > 0;
          return (
            <ConfirmDialog
              title={t("Delete Item")}
              message={
                inUse
                  ? uses.length === 1
                    ? t(
                        '"{name}" is still used by a recipe. Deleting it removes it from that recipe too; a recipe left with no ingredients is dropped and its product goes back to counted stock. This cannot be undone.',
                        { name: pendingDelete.name },
                      )
                    : t(
                        '"{name}" is still used by {n} recipes. Deleting it removes it from them too; a recipe left with no ingredients is dropped and its product goes back to counted stock. This cannot be undone.',
                        { name: pendingDelete.name, n: uses.length },
                      )
                  : t('Are you sure you want to delete "{name}"? This action cannot be undone.', {
                      name: pendingDelete.name,
                    })
              }
              confirmLabel={inUse ? t("Delete anyway") : t("Delete")}
              confirmDisabled={inUse && !forceAck}
              busy={deleting}
              onCancel={() => setPendingDelete(null)}
              onConfirm={handleDelete}
            >
              {inUse && (
                <div className="mt-4 space-y-3">
                  <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {uses.map((u) => (
                      <li key={u} className="flex items-center gap-2">
                        <span aria-hidden="true">📜</span>
                        <span className="truncate">{u}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={forceAck}
                      onChange={(e) => setForceAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-red-600 dark:border-stone-600"
                    />
                    <span>
                      {uses.length === 1
                        ? t("I understand — remove it from this recipe and delete the item.")
                        : t("I understand — remove it from these recipes and delete the item.")}
                    </span>
                  </label>
                </div>
              )}
            </ConfirmDialog>
          );
        })()
      )}
    </div>
  );
}
