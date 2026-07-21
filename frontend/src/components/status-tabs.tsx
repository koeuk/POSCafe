"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TabOption<T extends string> {
  label: string;
  value: T;
}

interface Pill {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Segmented tab bar whose active highlight slides to the tab you pick.
 *
 * The pill is measured from the live DOM rather than computed from index
 * widths, so labels of different lengths (and a wrapped second row on narrow
 * screens) all line up. Both axes are tracked for that reason — translateX
 * alone would leave the pill on row one after the row wraps.
 */
export function StatusTabs<T extends string>({
  options,
  value,
  onChange,
  label = "Filter",
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<Pill | null>(null);
  // Gates the transition so the pill doesn't fly in from the corner on mount.
  const [ready, setReady] = useState(false);

  const place = useCallback(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!el) return setPill(null);
    setPill({
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    });
  }, []);

  useEffect(() => {
    place();
    // Two frames: one for the initial placement to paint, one before we allow
    // transitions — otherwise the first render animates from (0,0).
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [place, value, options]);

  // Re-measure when the bar itself resizes (wrapping, sidebar collapse, fonts).
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [place]);

  // Arrow keys move between tabs, as expected of a tablist.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.value);
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
      [options.indexOf(next)]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative inline-flex flex-wrap gap-1 rounded-full border border-stone-200 bg-stone-100/70 p-1 dark:border-stone-800 dark:bg-stone-900/60"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 rounded-full bg-pos-button shadow-sm ${
          pill ? "opacity-100" : "opacity-0"
        } ${
          ready
            ? "transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            : ""
        }`}
        style={
          pill
            ? {
                transform: `translate(${pill.x}px, ${pill.y}px)`,
                width: pill.w,
                height: pill.h,
              }
            : undefined
        }
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
              active
                ? "text-pos-button-fg"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
