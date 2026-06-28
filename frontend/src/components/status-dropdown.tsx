"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 176; // matches w-44

/**
 * Color-coded order-status picker: a pill trigger and a listbox popover.
 * The menu is rendered in a portal with fixed positioning so it can't be
 * clipped by the card's `backdrop-filter` border-box (cards use the GLASS
 * style, and backdrop-filter clips its descendants).
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Anchor the fixed menu to the trigger's bottom-right corner.
  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.right - MENU_WIDTH });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }
    // Keep the menu glued to the trigger as the page scrolls / resizes.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, close, reposition]);

  function pick(status: OrderStatus) {
    if (status !== value) onChange(status);
    close();
  }

  const current = STATUS_META[value];

  return (
    <>
      <button
        ref={triggerRef}
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

      {open &&
        coords &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{ top: coords.top, left: coords.left }}
            className="pos-drop fixed z-50 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
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
          </ul>,
          document.body,
        )}
    </>
  );
}
