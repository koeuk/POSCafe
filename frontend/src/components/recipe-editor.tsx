"use client";

import { useMemo, useState } from "react";
import { PopSelect } from "@/components/pop-select";
import { api } from "@/lib/api";
import type { InventoryItem, Product, Recipe } from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

interface DraftLine {
  inventoryItemId: number;
  quantity: string;
}

function linesFromRecipe(recipe: Recipe | null): DraftLine[] {
  return (recipe?.items ?? []).map((item) => ({
    inventoryItemId: item.inventoryItemId,
    quantity: String(item.quantity),
  }));
}

/**
 * Inline recipe editor for one made-to-order product: what each sale of a
 * size takes out of Supplies. Sized products get one tab per size; the
 * "copy to all sizes" action saves the current lines for every size.
 */
export function RecipeEditor({
  product,
  recipes,
  inventoryItems,
  onSaved,
}: {
  product: Product;
  /** This product's saved recipes. */
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  onSaved: () => Promise<void>;
}) {
  const sizes = useMemo<(string | null)[]>(
    () =>
      product.variants && product.variants.length > 0
        ? product.variants.map((v) => v.size)
        : [null],
    [product.variants],
  );
  const [pickedSize, setPickedSize] = useState<string | null>(sizes[0]);
  const size = sizes.includes(pickedSize) ? pickedSize : sizes[0];
  const current = recipes.find((r) => r.size === size) ?? null;

  // Draft lines are keyed by size + saved recipe so switching tabs (or a
  // refetch after save) reseeds them instead of leaking edits across sizes.
  const draftKey = `${size ?? ""}|${current?.id ?? ""}|${current?.updatedAt ?? ""}`;
  const [draft, setDraft] = useState<{ key: string; lines: DraftLine[] }>({
    key: draftKey,
    lines: linesFromRecipe(current),
  });
  const lines = draft.key === draftKey ? draft.lines : linesFromRecipe(current);
  function setLines(next: DraftLine[]) {
    setDraft({ key: draftKey, lines: next });
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Servings the draft could make right now: the tightest line wins.
  const filledLines = lines.filter((l) => Number(l.quantity) > 0);
  const servings =
    filledLines.length === 0
      ? null
      : Math.floor(
          Math.min(
            ...filledLines.map((l) => {
              const inv = inventoryItems.find((i) => i.id === l.inventoryItemId);
              return inv ? Number(inv.stockQuantity) / Number(l.quantity) : 0;
            }),
          ),
        );

  const dirty =
    JSON.stringify(lines) !== JSON.stringify(linesFromRecipe(current));

  function addLine() {
    if (inventoryItems.length === 0) return;
    const unused =
      inventoryItems.find((inv) => !lines.some((l) => l.inventoryItemId === inv.id)) ??
      inventoryItems[0];
    setLines([...lines, { inventoryItemId: unused.id, quantity: "1" }]);
  }

  function payloadLines() {
    return lines
      .filter((l) => Number(l.quantity) > 0)
      .map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity) }));
  }

  async function save(targetSizes: (string | null)[]) {
    const items = payloadLines();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (items.length === 0) {
        if (current) await api(`/recipes/${current.id}`, { method: "DELETE" });
        setNotice("Recipe removed.");
      } else {
        for (const s of targetSizes) {
          await api("/recipes", {
            method: "POST",
            body: { productId: product.id, size: s, items },
          });
        }
        setNotice(
          targetSizes.length > 1
            ? `Recipe saved for ${targetSizes.length} sizes.`
            : "Recipe saved.",
        );
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Recipe — what one {product.name}
          {size ? ` (${size})` : ""} uses
        </p>
        {sizes.length > 1 && (
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm dark:bg-stone-800">
            {sizes.map((s) => {
              const has = recipes.some((r) => r.size === s);
              return (
                <button
                  key={s ?? "__base__"}
                  type="button"
                  onClick={() => {
                    setPickedSize(s);
                    setNotice(null);
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    size === s
                      ? "bg-pos-button text-pos-button-fg shadow-sm"
                      : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  }`}
                >
                  {s}
                  {!has && (
                    <span className="ml-1 text-[10px] font-medium opacity-70">
                      · none
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
            No ingredients yet. Add the cup, lid, straw and ingredients one
            {size ? ` ${size}` : ""} uses.
          </p>
        ) : (
          lines.map((line, index) => {
            const inv = inventoryItems.find((i) => i.id === line.inventoryItemId);
            return (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm dark:bg-stone-800"
              >
                <PopSelect
                  ariaLabel="Ingredient or packaging"
                  className="min-w-48 flex-1"
                  buttonClassName={INPUT}
                  value={String(line.inventoryItemId)}
                  onChange={(v) =>
                    setLines(
                      lines.map((l, i) =>
                        i === index ? { ...l, inventoryItemId: Number(v) } : l,
                      ),
                    )
                  }
                  options={inventoryItems.map((item) => ({
                    value: String(item.id),
                    label: `${item.name} (${item.unit})`,
                    hint: `${Number(item.stockQuantity)} left`,
                  }))}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, i) =>
                        i === index ? { ...l, quantity: e.target.value } : l,
                      ),
                    )
                  }
                  aria-label="Quantity per serving"
                  className={`${INPUT} w-24 text-right`}
                />
                <span className="w-8 text-xs text-stone-500 dark:text-stone-400">
                  {inv?.unit ?? ""}
                </span>
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  aria-label="Remove ingredient"
                  className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={addLine}
          disabled={inventoryItems.length === 0}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-pos-button hover:text-pos-button disabled:opacity-40 dark:border-stone-700 dark:text-stone-300"
        >
          <span className="text-base leading-none">＋</span>
          Add ingredient
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {inventoryItems.length === 0
            ? "Add cups and ingredients under Supplies first."
            : servings === null
              ? "Nothing to deduct yet."
              : `Supplies on hand cover ${servings} serving${servings === 1 ? "" : "s"}.`}
        </p>
        <div className="flex items-center gap-2">
          {sizes.length > 1 && lines.length > 0 && (
            <button
              type="button"
              onClick={() => save(sizes)}
              disabled={saving}
              title="Save these lines as the recipe for every size"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              Save for all sizes
            </button>
          )}
          <button
            type="button"
            onClick={() => save([size])}
            disabled={saving || (!dirty && lines.length > 0)}
            className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : lines.length === 0 && current ? "Remove recipe" : "Save recipe"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {notice && !error && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>
      )}
    </div>
  );
}
