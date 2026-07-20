"use client";

import { useEffect } from "react";

/**
 * Small centered confirmation modal. Closes on Escape or backdrop click.
 * Defaults to a destructive (red) confirm button.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
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

  // Freeze the page behind the dialog: no scrolling, nothing else clickable.
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
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
