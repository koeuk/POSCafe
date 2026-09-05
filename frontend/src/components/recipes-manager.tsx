"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  type InventoryItem,
  type Product,
  type Recipe,
} from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

interface RecipeDraftLine {
  inventoryItemId: number;
  quantity: string;
}

function linesFromRecipe(recipe: Recipe | null): RecipeDraftLine[] {
  return (recipe?.items ?? []).map((item) => ({
    inventoryItemId: item.inventoryItemId,
    quantity: String(item.quantity),
  }));
}

export function RecipesManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selection
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Draft recipe lines, tagged with the product/size/recipe they were seeded
  // from so switching selection (or saving) reseeds them — see draftKey.
  const [draft, setDraft] = useState<{ key: string; lines: RecipeDraftLine[] }>(
    { key: "", lines: [] },
  );
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productList, inventoryList, recipeList] = await Promise.all([
        api<Product[]>("/products"),
        api<InventoryItem[]>("/inventory"),
        api<Recipe[]>("/recipes"),
      ]);
      setProducts(productList);
      setInventoryItems(inventoryList);
      setRecipes(recipeList);
      // Select the first product on first load only — picking a product must
      // not refetch everything.
      setSelectedProductId((current) => current ?? productList[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Available sizes for selected product
  const sizeOptions = useMemo<(string | null)[]>(() => {
    if (!selectedProduct || !selectedProduct.variants || selectedProduct.variants.length === 0) {
      return [null];
    }
    return selectedProduct.variants.map((v) => v.size);
  }, [selectedProduct]);

  // The size actually being edited: the user's pick if the product sells it,
  // otherwise the product's first size (or none for a sizeless product).
  const effectiveSize = sizeOptions.includes(selectedSize)
    ? selectedSize
    : sizeOptions[0];

  // Find existing recipe for selected product + size
  const currentRecipe = useMemo(() => {
    if (!selectedProductId) return null;
    return (
      recipes.find(
        (r) => r.productId === selectedProductId && r.size === effectiveSize,
      ) || null
    );
  }, [recipes, selectedProductId, effectiveSize]);

  // Reseed the draft whenever the selection or the saved recipe changes.
  const draftKey = `${selectedProductId ?? ""}|${effectiveSize ?? ""}|${currentRecipe?.id ?? ""}|${currentRecipe?.updatedAt ?? ""}`;
  if (draft.key !== draftKey) {
    setDraft({ key: draftKey, lines: linesFromRecipe(currentRecipe) });
  }
  const draftLines =
    draft.key === draftKey ? draft.lines : linesFromRecipe(currentRecipe);
  function setDraftLines(
    update: RecipeDraftLine[] | ((lines: RecipeDraftLine[]) => RecipeDraftLine[]),
  ) {
    setDraft((d) => {
      const base = d.key === draftKey ? d.lines : linesFromRecipe(currentRecipe);
      return {
        key: draftKey,
        lines: typeof update === "function" ? update(base) : update,
      };
    });
  }

  // Servings the current draft could make right now: the tightest line wins.
  const draftServings = useMemo(() => {
    const lines = draftLines.filter((l) => Number(l.quantity) > 0);
    if (lines.length === 0) return null;
    return Math.floor(
      Math.min(
        ...lines.map((l) => {
          const inv = inventoryItems.find((i) => i.id === Number(l.inventoryItemId));
          return inv ? Number(inv.stockQuantity) / Number(l.quantity) : 0;
        }),
      ),
    );
  }, [draftLines, inventoryItems]);

  function addDraftLine() {
    if (inventoryItems.length === 0) return;
    const firstUnused =
      inventoryItems.find(
        (inv) => !draftLines.some((dl) => dl.inventoryItemId === inv.id),
      ) || inventoryItems[0];

    setDraftLines([
      ...draftLines,
      { inventoryItemId: firstUnused.id, quantity: "1" },
    ]);
  }

  function updateDraftLine(index: number, patch: Partial<RecipeDraftLine>) {
    setDraftLines((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function removeDraftLine(index: number) {
    setDraftLines((lines) => lines.filter((_, i) => i !== index));
  }

  async function handleSaveRecipe() {
    if (!selectedProductId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const itemsPayload = draftLines
        .filter((l) => Number(l.quantity) > 0)
        .map((l) => ({
          inventoryItemId: Number(l.inventoryItemId),
          quantity: Number(l.quantity),
        }));

      if (itemsPayload.length === 0 && currentRecipe) {
        // Delete recipe if all items removed
        await api(`/recipes/${currentRecipe.id}`, { method: "DELETE" });
      } else if (itemsPayload.length > 0) {
        await api("/recipes", {
          method: "POST",
          body: {
            productId: selectedProductId,
            size: effectiveSize,
            items: itemsPayload,
          },
        });
      }

      setSuccessMsg(
        itemsPayload.length === 0
          ? "Recipe removed — this item is now counted from Product Stock."
          : "Recipe saved — this item is now made to order from Consumable Supplies.",
      );
      const updatedRecipes = await api<Recipe[]>("/recipes");
      setRecipes(updatedRecipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-pos-page-fg">
          Drink & Product Recipe (BOM / Packaging Deduction)
        </h2>
        <p className="text-xs text-pos-page-fg/60">
          Configure ingredients (beans, milk) and packaging supplies (cups, lids, straws) used per cup.
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {successMsg && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/15 dark:text-green-300">
          {successMsg}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading recipe configuration…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left panel: Product & Size Selector */}
          <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
            <h3 className="mb-3 text-sm font-bold text-stone-900 dark:text-stone-100">
              1. Select Drink / Item
            </h3>

            <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
              {products.map((p) => {
                const isSelected = p.id === selectedProductId;
                const hasRecipe = recipes.some((r) => r.productId === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSuccessMsg(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      isSelected
                        ? "bg-pos-button text-pos-button-fg shadow-sm"
                        : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {hasRecipe && (
                      <span
                        className={`ml-2 text-[10px] ${
                          isSelected ? "opacity-90" : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        ✓ Recipe
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: Recipe builder for selected product */}
          <div className="lg:col-span-2 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
            {selectedProduct ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {selectedProduct.category?.name ?? "Uncategorized"}
                    </p>
                  </div>

                  {/* Size Tabs if sized product */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
                      {selectedProduct.variants.map((v) => (
                        <button
                          key={v.size}
                          type="button"
                          onClick={() => {
                            setSelectedSize(v.size);
                            setSuccessMsg(null);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            effectiveSize === v.size
                              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
                              : "text-stone-500 hover:text-stone-800 dark:text-stone-400"
                          }`}
                        >
                          Size: {v.size}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Recipe Ingredients & Packaging (per 1 drink sold)
                    </h4>
                    <button
                      type="button"
                      onClick={addDraftLine}
                      className="text-xs font-semibold text-pos-button hover:underline"
                    >
                      + Add Ingredient / Packaging
                    </button>
                  </div>

                  {draftLines.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-400 dark:border-stone-800">
                      No ingredients/packaging added for this drink yet. Click &ldquo;+ Add Ingredient / Packaging&rdquo; to define a recipe.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {draftLines.map((line, index) => {
                        const invItem = inventoryItems.find(
                          (i) => i.id === Number(line.inventoryItemId),
                        );
                        return (
                          <div
                            key={index}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-800/40"
                          >
                            <select
                              value={line.inventoryItemId}
                              onChange={(e) =>
                                updateDraftLine(index, {
                                  inventoryItemId: Number(e.target.value),
                                })
                              }
                              className={`${INPUT} min-w-48 flex-1`}
                            >
                              {inventoryItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) [{item.category}]
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateDraftLine(index, {
                                    quantity: e.target.value,
                                  })
                                }
                                placeholder="Qty"
                                className={`${INPUT} w-24 text-right`}
                              />
                              <span className="w-10 text-xs font-medium text-stone-500">
                                {invItem?.unit || ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDraftLine(index)}
                              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                              title="Remove Line"
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
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {draftServings === null
                        ? "Without a recipe, sales draw from Product Stock instead."
                        : `Ingredients on hand cover ${draftServings} serving${draftServings === 1 ? "" : "s"} right now.`}
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveRecipe}
                      disabled={saving}
                      className="rounded-xl bg-pos-button px-6 py-2.5 text-sm font-bold text-pos-button-fg shadow-sm transition hover:opacity-90 disabled:opacity-40"
                    >
                      {saving ? "Saving Recipe…" : "Save Recipe"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-400">Select a drink on the left to configure its recipe.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
