/**
 * Units of measure for consumables. A supply is stocked in one unit (the
 * unit on its inventory item) and a recipe line may be written in any unit
 * of the same family: coffee kept in kg, a recipe that takes 10 g. Every
 * calculation converts the recipe amount into the item's unit first, so
 * "1 kg − 10 g" is 0.99 kg and never 1 − 10.
 *
 * Units outside these families ('box', 'bottle', …) are allowed on items but
 * only convert to themselves.
 */

const FAMILIES: Record<string, Record<string, number>> = {
  // factor = how many of the family's base unit one unit holds
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000 },
  count: { pcs: 1 },
};

const CANONICAL: Record<string, string> = { l: 'L' };

/** Trims and canonicalises a unit name ('KG' → 'kg', 'l' → 'L'). */
export function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase();
  if (familyOf(key)) return CANONICAL[key] ?? key;
  return unit.trim();
}

function familyOf(unit: string): string | null {
  const key = unit.trim().toLowerCase();
  for (const [family, units] of Object.entries(FAMILIES)) {
    if (key in units) return family;
  }
  return null;
}

/** Whether a quantity in `from` can be expressed in `to`. */
export function unitsCompatible(from: string, to: string): boolean {
  const a = from.trim().toLowerCase();
  const b = to.trim().toLowerCase();
  if (a === b) return true;
  const family = familyOf(a);
  return family !== null && family === familyOf(b);
}

/** Units a recipe line may use for an item stocked in `unit` (itself first). */
export function compatibleUnits(unit: string): string[] {
  const key = unit.trim().toLowerCase();
  const family = familyOf(key);
  if (!family) return [unit.trim()];
  const self = CANONICAL[key] ?? key;
  return [
    self,
    ...Object.keys(FAMILIES[family])
      .filter((u) => u !== key)
      .map((u) => CANONICAL[u] ?? u),
  ];
}

/**
 * Converts `quantity` from one unit to another. Throws when the units are
 * not of the same family — callers validate with `unitsCompatible()` first.
 */
export function convertQuantity(
  quantity: number,
  from: string,
  to: string,
): number {
  const a = from.trim().toLowerCase();
  const b = to.trim().toLowerCase();
  if (a === b) return quantity;
  const family = familyOf(a);
  if (!family || family !== familyOf(b)) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  const factors = FAMILIES[family];
  return (quantity * factors[a]) / factors[b];
}

/**
 * Formats a quantity for messages, e.g. `10 g` or `0.99 kg`. Whole numbers
 * stay whole; fractions are trimmed to three decimals.
 */
export function formatQuantity(quantity: number, unit: string): string {
  const rounded = Math.round(quantity * 1000) / 1000;
  return `${rounded} ${unit}`;
}
