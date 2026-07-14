"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onClose` when a pointer press lands outside `ref`. Only listens while
 * `active` is true (pass the popover's open state). Replaces the copy-pasted
 * `mousedown` + ref-containment effect used by the sidebar, comboboxes, and
 * period/stock/staff popovers.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  active = true,
  options: { escape?: boolean } = {},
) {
  const { escape = false } = options;
  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);

    let onKey: ((event: KeyboardEvent) => void) | undefined;
    if (escape) {
      onKey = (event) => {
        if (event.key === "Escape") onClose();
      };
      document.addEventListener("keydown", onKey);
    }

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      if (onKey) document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active, escape]);
}
