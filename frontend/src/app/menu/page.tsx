import { effectivePrice, formatPrice, hasDiscount } from "@/lib/pricing";
import type { MenuCategory } from "@/lib/types";

// Customer-facing menu is always fresh (availability/prices change).
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getMenu(): Promise<MenuCategory[]> {
  const res = await fetch(`${API_URL}/menu`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load menu (${res.status})`);
  return res.json();
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

      <div className="mx-auto max-w-6xl px-4 py-8">
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

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {category.products.map((product) => (
                  <article
                    key={product.id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100"
                  >
                    {/* Image */}
                    <div className="relative aspect-square w-full bg-stone-100">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl">
                          ☕
                        </div>
                      )}
                      {hasDiscount(product) && (
                        <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
                          -{product.discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-3">
                      <p className="font-medium text-stone-900">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-semibold text-stone-900">
                          {formatPrice(effectivePrice(product))}
                        </span>
                        {hasDiscount(product) && (
                          <span className="text-xs text-stone-400 line-through">
                            {formatPrice(product.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
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
