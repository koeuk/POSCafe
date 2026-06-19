"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrderStatus } from "@/lib/types";

const STATUS_META: Record<
  OrderStatus,
  { label: string; pill: string; dot: string }
> = {
  [OrderStatus.PENDING]: {
    label: "Pending",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  [OrderStatus.PREPARING]: {
    label: "Preparing",
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  [OrderStatus.READY]: {
    label: "Ready",
    pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  [OrderStatus.COMPLETED]: {
    label: "Completed",
    pill: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    dot: "bg-green-500",
  },
  [OrderStatus.CANCELLED]: {
    label: "Cancelled",
    pill: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
    dot: "bg-stone-400",
  },
};

/**
 * Color-coded order-status picker. Same popover pattern as the product
 * category dropdown: a pill trigger, a listbox, and outside-click close.
 */
export function StatusDropdown({
  value,
  onChange,
  busy,
}: {
  value: OrderStatus;
  onChange: (status: OrderStatus) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  function pick(status: OrderStatus) {
    if (status !== value) onChange(status);
    close();
  }

  const current = STATUS_META[value];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Order status"
        className={`flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2.5 text-xs font-semibold ring-1 ring-inset ring-black/5 transition focus:ring-2 focus:ring-[#2A1D15]/30 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-white/10 ${current.pill}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
        {busy ? "…" : current.label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="pos-drop absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
        >
          {Object.values(OrderStatus).map((status) => {
            const meta = STATUS_META[status];
            const isSelected = status === value;
            return (
              <li key={status} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => pick(status)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-stone-800 ${
                    isSelected
                      ? "font-semibold text-stone-900 dark:text-stone-100"
                      : "text-stone-600 dark:text-stone-300"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                  {isSelected && (
                    <span className="ml-auto text-stone-400 dark:text-stone-500">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
