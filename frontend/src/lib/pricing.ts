import type { Product, ProductVariant, RecipeAvailability } from "./types";

type PriceOption = ProductVariant | string | number | null | undefined;

/** The product's size options, in display order (empty = no sizes). */
export function sizeOptions(product: Product): ProductVariant[] {
  return product.variants ?? [];
}

function resolveBasePrice(product: Product, option?: PriceOption): number {
  if (typeof option === "number") return option;
  if (typeof option === "string") {
    const match = product.variants?.find((v) => v.size === option);
    if (match) return Number(match.price);
  } else if (option && typeof option === "object") {
    return Number(option.price);
  }

  if (product.variants && product.variants.length > 0) {
    return Math.min(...product.variants.map((v) => Number(v.price)));
  }

  return Number(product.price);
}

/**
 * The effective unit price after the product's discount, rounded to cents.
 * Mirrors the backend calculation in orders.service.ts so the cart total
 * shown to the cashier matches what the server actually charges.
 */
export function effectivePrice(product: Product, option?: PriceOption): number {
  const base = resolveBasePrice(product, option);
  const discount = Math.min(Math.max(product.discountPercent ?? 0, 0), 100);
  return Math.round(base * (1 - discount / 100) * 100) / 100;
}

/** Whether the product has an active discount. */
export function hasDiscount(product: Product): boolean {
  return (product.discountPercent ?? 0) > 0;
}

/** Whether the product requires a size choice at checkout. */
export function hasSizes(product: Product): boolean {
  return Boolean(product.variants && product.variants.length > 0);
}

/**
 * The recipe availability for a product + size — same rule as the backend:
 * an exact size match wins, a size-less recipe is the default for every
 * size. null = no recipe covers that size (or the product is counted).
 */
export function recipeAvailability(
  product: Product,
  size: string | null,
): RecipeAvailability | null {
  if (product.stockMode !== "recipe") return null;
  const recipes = product.recipes ?? [];
  if (size) {
    const exact = recipes.find((r) => r.size === size);
    if (exact) return exact;
  }
  return recipes.find((r) => r.size === null) ?? null;
}

/** Whether the product is made to order from consumables. */
export function isRecipeManaged(product: Product): boolean {
  return product.stockMode === "recipe";
}

/**
 * Sellable units of one size: a made-to-order product's servings for that
 * size (0 when no recipe covers it), otherwise the product's stock count —
 * counted products keep one figure that every size draws from.
 */
export function sizeStock(product: Product, size: string | null): number {
  if (isRecipeManaged(product)) {
    return recipeAvailability(product, size)?.servings ?? 0;
  }
  return product.stock;
}

/**
 * Sellable units of the product as a whole. A counted product is its stock;
 * a made-to-order product's sizes share ingredients, so the best size counts.
 */
export function totalStock(product: Product): number {
  if (!isRecipeManaged(product)) return product.stock;
  const sizes = product.variants ?? [];
  if (sizes.length === 0) return sizeStock(product, null);
  return Math.max(0, ...sizes.map((v) => sizeStock(product, v.size)));
}

/** Format a numeric/string amount as USD (e.g. 3.5 -> "$3.50"). */
export function formatPrice(value: number | string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(value);
}

/**
 * A USD amount converted to riel at the given rate, rounded to the nearest
 * 100 riel (the smallest note in day-to-day use), e.g. 3.5 @ 4100 -> "៛14,400".
 */
export function formatKhr(usd: number | string, khrPerUsd: number): string {
  const n = Number(usd);
  if (!Number.isFinite(n) || khrPerUsd <= 0) return "";
  const riel = Math.round((n * khrPerUsd) / 100) * 100;
  return `៛${riel.toLocaleString("en-US")}`;
}
