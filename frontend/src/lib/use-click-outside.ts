"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onClose` when a pointer press lands outside `ref`. Only listens while
 * `active` is true (pass the popover's open state). Replaces the copy-pasted
 * `mousedown` + ref-containment effect used by the sidebar, comboboxes, and
 * period/stock/staff popovers.
 *
 * `options.also` names a second element that also counts as inside — a menu
 * rendered through a portal lives outside `ref` in the DOM, and without this
 * the press that picks an option would close the menu before the click lands.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  active = true,
  options: { escape?: boolean; also?: RefObject<HTMLElement | null> } = {},
) {
  const { escape = false, also } = options;
  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (also?.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) {
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
  }, [ref, onClose, active, escape, also]);
}
