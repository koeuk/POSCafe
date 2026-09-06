"use client";

import { useEffect, useState } from "react";
import { PopSelect } from "@/components/pop-select";
import { useT } from "@/lib/i18n";
import type { InventoryItem, RecipeOption } from "@/lib/types";

/** One cart line that offers customer's-choice add-ons. */
export interface ExtrasLine {
  key: string;
  title: string;
  quantity: number;
  options: RecipeOption[];
  /** inventoryItemId → amount per drink as typed, in the option's unit ("" = none). */
  chosen: Record<number, string>;
}

const INPUT =
  "w-24 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-right text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

/**
 * Checkout step for the customer's own choices: the cashier types how much
 * of each supply goes into one cup (15 g of sugar). The recipe's optional
 * lines are offered first; any other supply can be added below. Add-ons are
 * deducted on top of the recipe when the order is placed.
 */
export function CheckoutExtrasDialog({
  lines,
  supplies,
  busy,
  onChange,
  onRemove,
  onCancel,
  onConfirm,
}: {
  lines: ExtrasLine[];
  busy: boolean;
  supplies: InventoryItem[];
  onChange: (key: string, inventoryItemId: number, amount: string) => void;
  onRemove: (key: string, inventoryItemId: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-stone-950/40 px-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            {t("Add-ons for this order")}
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {t(
              "Type how much goes into one cup — sugar in grams, straw in pieces. Leave empty for none. Anything you add here comes out of Supplies when the order is placed.",
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {lines.map((line) => (
            <div
              key={line.key}
              className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950/40"
            >
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {line.quantity}× {line.title}
              </p>
              <ExtraRows
                line={line}
                supplies={supplies}
                busy={busy}
                onChange={onChange}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4 dark:border-stone-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {t("Back")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("Placing order…") : t("Place order")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One cart line's add-on rows: the recipe's optional lines, then any supply
 * the cashier picked, then the picker for adding another.
 */
function ExtraRows({
  line,
  supplies,
  busy,
  onChange,
  onRemove,
}: {
  line: ExtrasLine;
  supplies: InventoryItem[];
  busy: boolean;
  onChange: (key: string, inventoryItemId: number, amount: string) => void;
  onRemove: (key: string, inventoryItemId: number) => void;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);

  const fromRecipe = new Set(line.options.map((o) => o.inventoryItemId));
  // Supplies the cashier added by hand keep their place in pick order.
  const picked = Object.keys(line.chosen)
    .map(Number)
    .filter((id) => !fromRecipe.has(id));

  const rows = [
    ...line.options.map((o) => ({ ...o, suggested: true })),
    ...picked.map((id) => {
      const item = supplies.find((s) => s.id === id);
      return {
        inventoryItemId: id,
        name: item?.name ?? `#${id}`,
        quantity: 0,
        unit: item?.unit ?? "",
        suggested: false,
      };
    }),
  ];

  const addable = supplies.filter(
    (item) => !fromRecipe.has(item.id) && !picked.includes(item.id),
  );

  return (
    <>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.inventoryItemId}
            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 dark:bg-stone-900"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-stone-800 dark:text-stone-200">
                {row.name}
              </span>
              {row.suggested ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(line.key, row.inventoryItemId, String(row.quantity))
                  }
                  disabled={busy}
                  className="text-xs text-stone-400 underline-offset-2 hover:text-pos-button hover:underline dark:text-stone-500"
                  title={t("Use the recipe's usual amount")}
                >
                  {t("usual: {amount} {unit}", { amount: row.quantity, unit: row.unit })}
                </button>
              ) : (
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {t("extra from Supplies")}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={line.chosen[row.inventoryItemId] ?? ""}
                placeholder="0"
                disabled={busy}
                autoFocus={!row.suggested && !line.chosen[row.inventoryItemId]}
                onChange={(e) =>
                  onChange(line.key, row.inventoryItemId, e.target.value)
                }
                aria-label={t("{name} per cup ({unit})", { name: row.name, unit: row.unit })}
                className={INPUT}
              />
              <span className="w-8 text-xs text-stone-500 dark:text-stone-400">
                {row.unit}
              </span>
              {!row.suggested && (
                <button
                  type="button"
                  onClick={() => onRemove(line.key, row.inventoryItemId)}
                  disabled={busy}
                  aria-label={t("Remove {name}", { name: row.name })}
                  className="grid h-7 w-7 place-items-center rounded-md text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  ✕
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {addable.length > 0 &&
        (adding ? (
          <PopSelect
            ariaLabel={t("Add a supply")}
            className="mt-2"
            portal
            buttonClassName={`${INPUT} w-full text-left`}
            value=""
            placeholder={t("Pick a supply…")}
            onChange={(v) => {
              onChange(line.key, Number(v), "");
              setAdding(false);
            }}
            options={addable.map((item) => ({
              value: String(item.id),
              label: `${item.name} (${item.unit})`,
              hint: t("{n} left", { n: Number(item.stockQuantity) }),
            }))}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-pos-button hover:text-pos-button disabled:opacity-40 dark:border-stone-700 dark:text-stone-300"
          >
            <span className="text-sm leading-none">＋</span>
            {t("Add sugar, milk or another supply")}
          </button>
        ))}
    </>
  );
}
