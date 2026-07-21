/**
 * Shared theme-colour plumbing for the admin-customizable palette.
 *
 * Custom colours are injected as a <style> tag with separate `:root:not(.dark)`
 * and `.dark` blocks (instead of inline styles on <html>, which would override
 * BOTH modes with one value). That way a colour saved for light mode never
 * bleeds into dark mode, where its contrast pairing would be wrong — the CSS
 * cascade picks the right set whenever the theme class flips.
 */

/** One mode's worth of themeable surface colours (null = built-in default). */
export interface ThemeColorSet {
  buttonColor: string | null;
  pageBg: string | null;
  sidebarBg: string | null;
  sidebarActiveColor: string | null;
}

export const EMPTY_COLOR_SET: ThemeColorSet = {
  buttonColor: null,
  pageBg: null,
  sidebarBg: null,
  sidebarActiveColor: null,
};

// Which colour drives which CSS variable (defaults live in globals.css).
const VAR_OF: Record<keyof ThemeColorSet, string> = {
  buttonColor: "--pos-button",
  pageBg: "--pos-page",
  sidebarBg: "--pos-sidebar",
  sidebarActiveColor: "--pos-active",
};

export const THEME_COLOR_KEYS = Object.keys(VAR_OF) as (keyof ThemeColorSet)[];

/**
 * Readable text colour (near-black or near-white) for a given hex background,
 * by perceived luminance. Keeps label text legible on whatever accent colour
 * an admin picks — otherwise a dark custom colour leaves the built-in dark
 * text unreadable.
 */
export function readableForeground(hex: string): string {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#fff7ed";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0c0a09" : "#fff7ed";
}

// The style tag is built from user-entered strings, so only pass through
// plausible CSS colour values — anything with structural characters ( ; { } )
// could break out of the declaration.
function isSafeColor(value: string): boolean {
  return /^[#a-zA-Z0-9(),.%\s/-]+$/.test(value) && value.length <= 64;
}

/** Build one `selector { --var: value; … }` block (empty string if no overrides). */
function cssBlock(selector: string, set: ThemeColorSet): string {
  const lines: string[] = [];
  for (const key of THEME_COLOR_KEYS) {
    const value = set[key];
    if (value && isSafeColor(value)) lines.push(`${VAR_OF[key]}: ${value};`);
  }
  // Surfaces carry text — pair each customized one with a computed readable
  // foreground so labels stay legible on any colour the admin picks. Muted
  // variants are derived in the UI via opacity modifiers (e.g. /70).
  if (set.buttonColor && isSafeColor(set.buttonColor)) {
    lines.push(`--pos-button-fg: ${readableForeground(set.buttonColor)};`);
  }
  if (set.sidebarActiveColor && isSafeColor(set.sidebarActiveColor)) {
    lines.push(`--pos-active-fg: ${readableForeground(set.sidebarActiveColor)};`);
  }
  if (set.sidebarBg && isSafeColor(set.sidebarBg)) {
    lines.push(`--pos-sidebar-fg: ${readableForeground(set.sidebarBg)};`);
  }
  if (set.pageBg && isSafeColor(set.pageBg)) {
    lines.push(`--pos-page-fg: ${readableForeground(set.pageBg)};`);
  }
  return lines.length ? `${selector} { ${lines.join(" ")} }` : "";
}

const STYLE_ATTR = "data-pos-branding";

/**
 * Reflect the custom palettes on the page via a managed <style> tag in <head>.
 * Appended after the compiled stylesheet, so its blocks win over the
 * globals.css defaults at equal specificity; surfaces with no override fall
 * back to those defaults per mode.
 */
export function applyThemeColors(light: ThemeColorSet, dark: ThemeColorSet) {
  if (typeof document === "undefined") return;

  // Clear any legacy inline overrides (the pre-per-mode mechanism) so they
  // can't shadow the stylesheet.
  const root = document.documentElement;
  for (const cssVar of Object.values(VAR_OF)) root.style.removeProperty(cssVar);
  root.style.removeProperty("--pos-button-fg");
  root.style.removeProperty("--pos-active-fg");

  const css = [cssBlock(":root:not(.dark)", light), cssBlock(".dark", dark)]
    .filter(Boolean)
    .join("\n");

  let tag = document.head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTR}]`);
  if (!css) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.setAttribute(STYLE_ATTR, "true");
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) tag.textContent = css;
}
