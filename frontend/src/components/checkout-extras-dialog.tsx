"use client";

import { useEffect } from "react";
import type { RecipeOption } from "@/lib/types";

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
 * Checkout step for drinks whose recipe has optional lines (sugar, straw…):
 * the cashier types how much of each goes into one cup (15 g of sugar).
 * Leave it empty for none. Nothing is deducted until the order is placed.
 */
export function CheckoutExtrasDialog({
  lines,
  busy,
  onChange,
  onCancel,
  onConfirm,
}: {
  lines: ExtrasLine[];
  busy: boolean;
  onChange: (key: string, inventoryItemId: number, amount: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
            Add-ons for this order
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Type how much goes into one cup — sugar in grams, straw in pieces.
            Leave empty for none. The amount is taken from Supplies when the
            order is placed.
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
              <ul className="mt-2 space-y-1.5">
                {line.options.map((opt) => {
                  const amount = line.chosen[opt.inventoryItemId] ?? "";
                  const fillDefault = () =>
                    onChange(line.key, opt.inventoryItemId, String(opt.quantity));
                  return (
                    <li
                      key={opt.inventoryItemId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 dark:bg-stone-900"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-stone-800 dark:text-stone-200">
                          {opt.name}
                        </span>
                        <button
                          type="button"
                          onClick={fillDefault}
                          disabled={busy}
                          className="text-xs text-stone-400 underline-offset-2 hover:text-pos-button hover:underline dark:text-stone-500"
                          title="Use the recipe's usual amount"
                        >
                          usual: {opt.quantity} {opt.unit}
                        </button>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={amount}
                          placeholder="0"
                          disabled={busy}
                          onChange={(e) =>
                            onChange(line.key, opt.inventoryItemId, e.target.value)
                          }
                          aria-label={`${opt.name} per cup (${opt.unit})`}
                          className={INPUT}
                        />
                        <span className="w-8 text-xs text-stone-500 dark:text-stone-400">
                          {opt.unit}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
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
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-pos-button px-4 py-2 text-sm font-semibold text-pos-button-fg transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
