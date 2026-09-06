"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useClickOutside } from "@/lib/use-click-outside";
import { GLASS } from "@/lib/ui";

export interface PopSelectOption {
  value: string;
  label: string;
  /** Small secondary text on the right of the row (e.g. a count). */
  hint?: string;
}

/**
 * Dropdown with the pop-in menu look used across the admin screens, in place
 * of a native <select>. Single-select; keyboard: Enter/Space opens, Escape
 * closes (via useClickOutside), options are real buttons so Tab/Enter work.
 *
 * Set `portal` inside a scrolling box (a modal's body): the menu is then
 * rendered to <body> and positioned over everything, instead of being clipped
 * by that box.
 */
export function PopSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className = "",
  buttonClassName = "",
  portal = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PopSelectOption[];
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  /** Applied to the trigger — pass the form's input style here. */
  buttonClassName?: string;
  /** Render the menu to <body> so a scrolling ancestor can't clip it. */
  portal?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open, {
    escape: true,
    also: portal ? menuRef : undefined,
  });

  // Screen coordinates for the portalled menu: under the trigger, flipped
  // above when the space below is too tight. Recomputed before paint each
  // time it opens, so coordinates left over from last time are never shown.
  const [coords, setCoords] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!portal || !open) return;
    const place = () => {
      const button = ref.current?.getBoundingClientRect();
      if (!button) return;
      const below = window.innerHeight - button.bottom;
      const flip = below < 280 && button.top > below;
      setCoords({
        left: button.left,
        width: button.width,
        ...(flip
          ? { bottom: window.innerHeight - button.top + 8 }
          : { top: button.bottom + 8 }),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [portal, open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`${buttonClassName} flex w-full cursor-pointer items-center justify-between gap-2 text-left transition hover:border-stone-400 dark:hover:border-stone-600`}
      >
        <span
          className={`truncate ${current ? "" : "text-stone-400 dark:text-stone-500"}`}
        >
          {current?.label ?? placeholder ?? t("Select…")}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 dark:text-stone-500 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !portal && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 z-30 mt-2 max-h-64 w-full origin-top overflow-y-auto rounded-xl p-1 shadow-lg ${GLASS}`}
          style={{ animation: "menu-pop 160ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  active
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-700/60 dark:text-stone-100"
                    : "text-stone-600 hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-stone-700/40"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && !active && (
                  <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                    {o.hint}
                  </span>
                )}
                {active && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-pos-button"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {open &&
        portal &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className={`fixed z-[60] max-h-64 origin-top overflow-y-auto rounded-xl p-1 shadow-lg ${GLASS}`}
            style={{
              left: coords.left,
              width: coords.width,
              top: coords.top,
              bottom: coords.bottom,
              animation: "menu-pop 160ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  active
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-700/60 dark:text-stone-100"
                    : "text-stone-600 hover:bg-stone-100/70 dark:text-stone-300 dark:hover:bg-stone-700/40"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && !active && (
                  <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                    {o.hint}
                  </span>
                )}
                {active && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-pos-button"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
          </div>,
          document.body,
        )}
    </div>
  );
}
