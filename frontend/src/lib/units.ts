// Units of measure for supplies — mirrors backend/src/inventory/units.ts.
// A supply is stocked in one unit; a recipe line may use any unit of the
// same family (coffee kept in kg, a recipe that takes 10 g).

const FAMILIES: Record<string, Record<string, number>> = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000 },
  count: { pcs: 1 },
};

const CANONICAL: Record<string, string> = { l: "L" };

function familyOf(unit: string): string | null {
  const key = unit.trim().toLowerCase();
  for (const [family, units] of Object.entries(FAMILIES)) {
    if (key in units) return family;
  }
  return null;
}

/** Units a recipe line may use for a supply stocked in `unit` (itself first). */
export function compatibleUnits(unit: string): string[] {
  const key = unit.trim().toLowerCase();
  const family = familyOf(key);
  if (!family) return [unit.trim()];
  return [
    CANONICAL[key] ?? key,
    ...Object.keys(FAMILIES[family])
      .filter((u) => u !== key)
      .map((u) => CANONICAL[u] ?? u),
  ];
}

/** Converts between units of one family; returns `quantity` unchanged otherwise. */
export function convertQuantity(quantity: number, from: string, to: string): number {
  const a = from.trim().toLowerCase();
  const b = to.trim().toLowerCase();
  if (a === b) return quantity;
  const family = familyOf(a);
  if (!family || family !== familyOf(b)) return quantity;
  const factors = FAMILIES[family];
  return (quantity * factors[a]) / factors[b];
}
