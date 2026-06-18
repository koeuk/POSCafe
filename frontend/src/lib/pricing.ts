import type { Product, ProductSize } from "./types";

type PriceOption = ProductSize | string | number | null | undefined;

function resolveBasePrice(product: Product, option?: PriceOption): number {
  if (typeof option === "number") return option;
  if (typeof option === "string") {
    const match = product.sizes?.find((size) => size.size === option);
    if (match) return Number(match.price);
  } else if (option && typeof option === "object") {
    return Number(option.price);
  }

  if (product.sizes && product.sizes.length > 0) {
    return Math.min(...product.sizes.map((size) => Number(size.price)));
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
  return Boolean(product.sizes && product.sizes.length > 0);
}

/** Format a numeric/string amount as USD (e.g. 3.5 -> "$3.50"). */
export function formatPrice(value: number | string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(value);
}
