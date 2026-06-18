import type { MenuCategory } from "@/lib/types";

// Customer-facing menu is always fresh (availability/prices change).
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getMenu(): Promise<MenuCategory[]> {
  const res = await fetch(`${API_URL}/menu`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load menu (${res.status})`);
  return res.json();
}

function formatPrice(price: string): string {
  const n = Number(price);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : price;
}

export default async function MenuPage() {
  let menu: MenuCategory[] = [];
  let error: string | null = null;
  try {
    menu = await getMenu();
  } catch {
    error = "Sorry, the menu is unavailable right now.";
  }

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-stone-900 px-6 py-10 text-center text-stone-50">
        <h1 className="text-4xl font-bold tracking-tight">☕ POSCAFE</h1>
        <p className="mt-2 text-sm text-stone-300">Our Menu</p>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-6 text-center text-red-600">
            {error}
          </p>
        )}

        {!error && menu.length === 0 && (
          <p className="px-4 py-16 text-center text-stone-400">
            The menu is empty at the moment. Please check back soon.
          </p>
        )}

        <div className="space-y-10">
          {menu.map((category) => (
            <section key={category.id}>
              <h2 className="mb-1 text-2xl font-semibold text-stone-900">
                {category.name}
              </h2>
              {category.description && (
                <p className="mb-4 text-sm text-stone-500">
                  {category.description}
                </p>
              )}

              <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white shadow-sm">
                {category.products.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center gap-4 px-4 py-4"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl">
                        ☕
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <span className="flex-shrink-0 font-semibold text-stone-900">
                      {formatPrice(product.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-12 pb-8 text-center text-xs text-stone-400">
          Prices in USD · Ask our staff to place your order
        </footer>
      </div>
    </main>
  );
}
