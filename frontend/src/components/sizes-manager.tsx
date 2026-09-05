"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api } from "@/lib/api";
import type { Size } from "@/lib/types";

const INPUT =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 outline-none transition focus:border-pos-button focus:ring-2 focus:ring-pos-button/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500";

/**
 * The global size catalog (Small / Medium / Large…) products pick their size
 * options from. Lives on the Products page next to the product form that
 * uses it.
 */
export function SizesManager({
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete size");
    } finally {
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            Sizes
          </h2>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
            The size options a product can offer (e.g. S, M, L). Each size
            only sets a price — stock is tracked per product.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New size (e.g. XL)"
            className={`${INPUT} w-40`}
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
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sizes.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 py-1 pl-3 pr-1.5 text-sm dark:border-stone-700 dark:bg-stone-800"
          >
            <input
              defaultValue={s.name}
              onBlur={(e) => rename(s, e.target.value)}
              aria-label={`Rename size ${s.name}`}
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
