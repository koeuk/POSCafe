/**
 * Money helpers. TypeORM returns DECIMAL columns as strings, so amounts are
 * coerced at the boundary and all cent-rounding goes through one place to keep
 * stored totals free of floating-point drift.
 */

/** Rounds a monetary amount to whole cents. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coerces a DECIMAL-as-string (or number) to a number. */
export function toNumber(value: number | string): number {
  return Number(value);
}
