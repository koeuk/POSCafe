"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PopSelect } from "@/components/pop-select";
import { api } from "@/lib/api";
import {
  type InventoryItem,
  type InventoryMovement,
  type Recipe,
} from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

// Sentinel option in the unit / group pickers that reveals a free-text input.
const NEW_UNIT = "__new__";
const NEW_GROUP = "__new_group__";
// The three kinds of supplies a café keeps. Anything else can be typed in.
const SUPPLY_GROUPS = ["Raw Materials", "Packaging", "Operating Supplies"];
// Common units of measure; anything else can be typed in.
const DEFAULT_UNITS = ["pcs", "g", "kg", "ml", "L"];

// Human labels for the journal reasons written by the backend.
const REASON_LABELS: Record<string, string> = {
  restock: "restock",
  correction: "correction",
  order_deduction: "sold",
  order_refund: "returned (cancel/refund)",
};

export function ConsumablesManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add/Edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: SUPPLY_GROUPS[0],
    unit: "pcs",
    stockQuantity: "0",
    minThreshold: "10",
  });
  const [submitting, setSubmitting] = useState(false);

  // Quick Restock modal state
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockDelta, setRestockDelta] = useState("");
  const [restockReason, setRestockReason] = useState("");
  const [restocking, setRestocking] = useState(false);

  // Delete confirm modal
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);
  // Force-delete guard: the user must tick the checkbox when recipes use the item.
  const [forceAck, setForceAck] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemList, recipeList, movementList] = await Promise.all([
        api<InventoryItem[]>("/inventory"),
        api<Recipe[]>("/recipes"),
        api<InventoryMovement[]>("/inventory/movements?limit=30"),
      ]);
      setItems(itemList);
      setRecipes(recipeList);
      setMovements(movementList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
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
  }, [items, query, categoryFilter]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => Number(i.stockQuantity) <= Number(i.minThreshold)).length;
  }, [items]);

  // Group names for the filter tabs and the picker: the three standard
  // groups, plus any custom name an existing item carries.
  const categoryNames = useMemo(() => {
    const names = [...SUPPLY_GROUPS];
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
      category: SUPPLY_GROUPS[0],
      unit: "pcs",
      stockQuantity: "100",
      minThreshold: "20",
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
        category: formData.category.trim() || SUPPLY_GROUPS[0],
        unit: formData.unit.trim(),
        stockQuantity: Number(formData.stockQuantity) || 0,
        minThreshold: Number(formData.minThreshold) || 0,
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
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!restockItem) return;
    const delta = Number(restockDelta);
    if (isNaN(delta) || delta === 0) return;

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
      setError(err instanceof Error ? err.message : "Failed to restock item");
    } finally {
      setRestocking(false);
    }
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
      setError(err instanceof Error ? err.message : "Failed to delete item");
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
            Consumable Supplies & Raw Ingredients
          </h2>
          <p className="text-xs text-pos-page-fg/60">
            Track packaging (cups, lids, straws) and raw materials (coffee beans, milk, syrups).
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-xl bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg shadow-sm transition hover:opacity-90"
        >
          + Add Consumable Item
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Category filter & Search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-900">
          {[
            { id: "all", label: "All Items" },
            ...categoryNames.map((c) => ({ id: c.toLowerCase(), label: c })),
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
          placeholder="Search items…"
          className={`${INPUT} w-52`}
        />

        {lowStockCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            ⚠️ {lowStockCount} items low in stock
          </span>
        )}
      </div>

      {/* Items Table / Cards */}
      {loading ? (
        <p className="text-sm text-stone-500">Loading supplies inventory…</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400 dark:border-stone-800">
          No consumable items match your filter.
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
                          {item.category}
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
                            📜 Used by {uses.length === 1 ? uses[0] : `${uses.length} recipes`}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                            Not used by any recipe yet
                          </p>
                        );
                      })()}
                    </div>
                    {isLow && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-400">
                        Low Stock
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
                      Min: {minThresh} {item.unit}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRestockItem(item);
                      setRestockDelta("50");
                      setRestockReason("Restock");
                    }}
                    className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25"
                  >
                    + Adjust / Restock
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      title="Edit Item"
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
                      title="Delete Item"
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

      {/* Recent Movements Feed */}
      {movements.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
            Recent Consumable Stock Movements
          </h3>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {movements.map((m) => {
              const deltaNum = Number(m.delta);
              const isPlus = deltaNum > 0;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold tabular-nums ${
                        isPlus
                          ? "text-green-600 dark:text-green-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isPlus ? `+${deltaNum}` : deltaNum}
                    </span>
                    <span className="font-medium text-stone-900 dark:text-stone-100">
                      {m.inventoryItem?.name ?? `Item #${m.inventoryItemId}`}
                    </span>
                    <span className="text-stone-400">({REASON_LABELS[m.reason] ?? m.reason})</span>
                  </div>
                  <div className="text-stone-400">
                    {new Date(m.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {editingItem ? "Edit Consumable Item" : "Add New Consumable Item"}
            </h3>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Plastic Cup 16oz"
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    Group
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
                        label: c,
                        hint: counts.get(c)
                          ? `${counts.get(c)} item${counts.get(c) === 1 ? "" : "s"}`
                          : undefined,
                      })),
                      { value: NEW_GROUP, label: "Other…", hint: undefined },
                    ];
                    return (
                      <>
                        <PopSelect
                          ariaLabel="Group"
                          className="mt-1"
                          buttonClassName={INPUT}
                          value={custom ? NEW_GROUP : formData.category}
                          placeholder="Select a group"
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
                            placeholder="Group name"
                            aria-label="Custom group name"
                            className={`${INPUT} mt-2 w-full`}
                          />
                        )}
                        <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
                          Raw materials go into drinks, packaging leaves with
                          the order, operating supplies are used in the shop.
                        </p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    Unit of Measure
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
                          ariaLabel="Unit of measure"
                          className="mt-1"
                          buttonClassName={INPUT}
                          value={isKnown ? formData.unit : NEW_UNIT}
                          onChange={(v) =>
                            setFormData({ ...formData, unit: v === NEW_UNIT ? "" : v })
                          }
                          options={[
                            ...units.map((u) => ({ value: u, label: u })),
                            { value: NEW_UNIT, label: "+ Other unit…" },
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
                            placeholder="e.g. box, bottle"
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
                    Initial Stock
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
                    Min Alert Threshold
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

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? "Saving…" : "Save Item"}
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
              Adjust Stock: {restockItem.name}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Current stock: {Number(restockItem.stockQuantity).toLocaleString()}{" "}
              {restockItem.unit}
            </p>

            <form onSubmit={handleRestock} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  Quantity Adjustment (+ to add, - to subtract)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={restockDelta}
                  onChange={(e) => setRestockDelta(e.target.value)}
                  placeholder="e.g. +100 or -10"
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder="e.g. Restock, Spoilage, Correction"
                  className={`${INPUT} mt-1 w-full`}
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restocking}
                  className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:opacity-40"
                >
                  {restocking ? "Saving…" : "Confirm Adjustment"}
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
              title="Delete Item"
              message={
                inUse
                  ? `"${pendingDelete.name}" is still used by ${uses.length === 1 ? "a recipe" : `${uses.length} recipes`}. Deleting it removes it from ${uses.length === 1 ? "that recipe" : "them"} too; a recipe left with no ingredients is dropped and its product goes back to counted stock. This cannot be undone.`
                  : `Are you sure you want to delete "${pendingDelete.name}"? This action cannot be undone.`
              }
              confirmLabel={inUse ? "Delete anyway" : "Delete"}
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
                      I understand — remove it from{" "}
                      {uses.length === 1 ? "this recipe" : "these recipes"} and delete the item.
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
