/**
 * Seeds the catalog with 45 demo products.
 *
 *   npm run seed
 *
 * Idempotent: products are matched by name (case-insensitive), so re-running
 * only inserts what's missing and never duplicates. Categories referenced here
 * are created if they don't exist yet.
 *
 * Goes through ProductsService.create() rather than the repository so the
 * per-size ProductVariant stock rows are generated the same way the admin UI
 * would create them.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CategoriesService } from './categories/categories.service';
import { ProductsService } from './products/products.service';

interface SeedSize {
  size: string;
  price: number;
  stock: number;
}

interface SeedProduct {
  name: string;
  category: string;
  description: string;
  /** Base price. For sized items this mirrors the smallest size. */
  price: number;
  discountPercent?: number;
  /** Sized drinks: per-size price + stock (source of truth for stock). */
  sizes?: SeedSize[];
  /** Sizeless items only: whole-product stock. */
  stock?: number;
}

/** S/M/L ladder: +$0.50 per step up, matching the existing catalog. */
function sml(base: number, stocks: [number, number, number]): SeedSize[] {
  return [
    { size: 'S', price: round(base), stock: stocks[0] },
    { size: 'M', price: round(base + 0.5), stock: stocks[1] },
    { size: 'L', price: round(base + 1.0), stock: stocks[2] },
  ];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const PRODUCTS: SeedProduct[] = [
  // ── Espresso ─────────────────────────────────────────────────────────────
  // Fixed-volume shots: no size choice, whole-product stock.
  {
    name: 'Espresso',
    category: 'Espresso',
    description: 'A single shot of our house blend — bold and syrupy.',
    price: 2.0,
    stock: 80,
  },
  {
    name: 'Double Espresso',
    category: 'Espresso',
    description: 'Two shots for when one just will not do.',
    price: 2.75,
    stock: 70,
  },
  {
    name: 'Ristretto',
    category: 'Espresso',
    description: 'Short-pulled shot: sweeter and more concentrated.',
    price: 2.25,
    stock: 60,
  },
  {
    name: 'Lungo',
    category: 'Espresso',
    description: 'Long-pulled shot with a lighter, gentler body.',
    price: 2.5,
    stock: 55,
  },
  {
    name: 'Macchiato',
    category: 'Espresso',
    description: 'Espresso "marked" with a spoonful of milk foam.',
    price: 2.75,
    stock: 50,
  },
  {
    name: 'Cortado',
    category: 'Espresso',
    description: 'Equal parts espresso and warm steamed milk.',
    price: 3.25,
    stock: 45,
  },
  {
    name: 'Piccolo Latte',
    category: 'Espresso',
    description: 'A ristretto topped with silky milk in a small glass.',
    price: 3.25,
    stock: 40,
  },
  {
    name: 'Affogato',
    category: 'Espresso',
    description: 'Vanilla ice cream drowned in a hot espresso shot.',
    price: 4.5,
    discountPercent: 10,
    stock: 30,
  },
  // Milk & iced drinks: S/M/L.
  {
    name: 'Caramel Macchiato',
    category: 'Espresso',
    description: 'Vanilla, steamed milk and espresso with caramel drizzle.',
    price: 4.25,
    sizes: sml(4.25, [30, 35, 28]),
  },
  {
    name: 'Vanilla Latte',
    category: 'Espresso',
    description: 'Espresso and steamed milk with vanilla syrup.',
    price: 4.0,
    sizes: sml(4.0, [34, 40, 30]),
  },
  {
    name: 'Hazelnut Latte',
    category: 'Espresso',
    description: 'Toasted hazelnut syrup folded into a classic latte.',
    price: 4.0,
    discountPercent: 15,
    sizes: sml(4.0, [26, 30, 22]),
  },
  {
    name: 'Caffè Breve',
    category: 'Espresso',
    description: 'Espresso with steamed half-and-half — rich and creamy.',
    price: 4.5,
    sizes: sml(4.5, [20, 24, 18]),
  },
  {
    name: 'Iced Americano',
    category: 'Espresso',
    description: 'Espresso over cold water and ice. Crisp and clean.',
    price: 3.0,
    sizes: sml(3.0, [45, 50, 40]),
  },
  {
    name: 'Iced Latte',
    category: 'Espresso',
    description: 'Chilled milk and espresso poured over ice.',
    price: 3.75,
    sizes: sml(3.75, [42, 48, 38]),
  },
  {
    name: 'Cold Brew',
    category: 'Espresso',
    description: 'Steeped 18 hours for a smooth, low-acid cup.',
    price: 4.0,
    sizes: sml(4.0, [36, 40, 32]),
  },
  {
    name: 'Nitro Cold Brew',
    category: 'Espresso',
    description: 'Cold brew on nitrogen — cascading and velvety.',
    price: 4.75,
    sizes: sml(4.75, [24, 28, 20]),
  },
  {
    name: 'Salted Caramel Cold Brew',
    category: 'Espresso',
    description: 'Cold brew with salted caramel and a cream float.',
    price: 4.75,
    discountPercent: 10,
    sizes: sml(4.75, [22, 26, 18]),
  },
  {
    name: 'Coconut Cold Brew',
    category: 'Espresso',
    description: 'Cold brew lengthened with coconut milk.',
    price: 4.5,
    sizes: sml(4.5, [20, 24, 16]),
  },

  // ── Tea ──────────────────────────────────────────────────────────────────
  {
    name: 'English Breakfast',
    category: 'Tea',
    description: 'Full-bodied black tea. Takes milk beautifully.',
    price: 2.5,
    sizes: sml(2.5, [40, 44, 36]),
  },
  {
    name: 'Earl Grey',
    category: 'Tea',
    description: 'Black tea scented with bergamot oil.',
    price: 2.75,
    sizes: sml(2.75, [38, 42, 34]),
  },
  {
    name: 'Jasmine Tea',
    category: 'Tea',
    description: 'Green tea layered with fresh jasmine blossom.',
    price: 2.75,
    sizes: sml(2.75, [34, 38, 30]),
  },
  {
    name: 'Oolong Tea',
    category: 'Tea',
    description: 'Semi-oxidised leaves — floral with a toasty finish.',
    price: 3.0,
    sizes: sml(3.0, [28, 32, 26]),
  },
  {
    name: 'Peppermint Tea',
    category: 'Tea',
    description: 'Caffeine-free peppermint leaf. Bright and cooling.',
    price: 2.5,
    sizes: sml(2.5, [30, 34, 28]),
  },
  {
    name: 'Chamomile Tea',
    category: 'Tea',
    description: 'Soft floral infusion — our most calming cup.',
    price: 2.5,
    sizes: sml(2.5, [30, 33, 27]),
  },
  {
    name: 'Lemongrass Ginger Tea',
    category: 'Tea',
    description: 'Fresh lemongrass and ginger, gently spiced.',
    price: 3.0,
    sizes: sml(3.0, [26, 30, 24]),
  },
  {
    name: 'Hibiscus Iced Tea',
    category: 'Tea',
    description: 'Tart hibiscus over ice. Deep ruby colour.',
    price: 3.25,
    sizes: sml(3.25, [32, 36, 30]),
  },
  {
    name: 'Thai Iced Tea',
    category: 'Tea',
    description: 'Spiced black tea with condensed milk over ice.',
    price: 3.75,
    discountPercent: 10,
    sizes: sml(3.75, [30, 34, 28]),
  },
  {
    name: 'Lemon Iced Tea',
    category: 'Tea',
    description: 'Black tea, fresh lemon and a touch of cane sugar.',
    price: 3.0,
    sizes: sml(3.0, [34, 38, 32]),
  },
  {
    name: 'Honey Yuzu Tea',
    category: 'Tea',
    description: 'Korean yuzu marmalade stirred into hot water.',
    price: 3.5,
    sizes: sml(3.5, [22, 26, 20]),
  },
  {
    name: 'Matcha Frappe',
    category: 'Tea',
    description: 'Blended ceremonial matcha with milk and ice.',
    price: 4.75,
    discountPercent: 15,
    sizes: sml(4.75, [24, 28, 22]),
  },

  // ── Pastry ───────────────────────────────────────────────────────────────
  {
    name: 'Almond Croissant',
    category: 'Pastry',
    description: 'Twice-baked croissant filled with almond cream.',
    price: 3.25,
    stock: 24,
  },
  {
    name: 'Pain au Chocolat',
    category: 'Pastry',
    description: 'Laminated pastry wrapped around dark chocolate.',
    price: 3.5,
    stock: 22,
  },
  {
    name: 'Blueberry Muffin',
    category: 'Pastry',
    description: 'Buttermilk muffin packed with blueberries.',
    price: 3.0,
    stock: 26,
  },
  {
    name: 'Banana Bread',
    category: 'Pastry',
    description: 'Thick slice, toasted on request.',
    price: 2.75,
    stock: 20,
  },
  {
    name: 'Cinnamon Roll',
    category: 'Pastry',
    description: 'Soft roll with cinnamon sugar and cream-cheese glaze.',
    price: 3.5,
    discountPercent: 10,
    stock: 18,
  },
  {
    name: 'Chocolate Brownie',
    category: 'Pastry',
    description: 'Fudgy centre, crackled top, sea-salt finish.',
    price: 3.25,
    stock: 28,
  },
  {
    name: 'Carrot Cake',
    category: 'Pastry',
    description: 'Spiced carrot sponge with cream-cheese frosting.',
    price: 4.25,
    stock: 14,
  },
  {
    name: 'Red Velvet Slice',
    category: 'Pastry',
    description: 'Cocoa sponge layered with vanilla cream cheese.',
    price: 4.5,
    stock: 12,
  },
  {
    name: 'Tiramisu Cup',
    category: 'Pastry',
    description: 'Espresso-soaked sponge and mascarpone, in a jar.',
    price: 4.75,
    discountPercent: 15,
    stock: 16,
  },
  {
    name: 'Egg Tart',
    category: 'Pastry',
    description: 'Flaky shell with a silky baked custard.',
    price: 1.75,
    stock: 40,
  },
  {
    name: 'Ham & Cheese Croissant',
    category: 'Pastry',
    description: 'Butter croissant with smoked ham and gruyère.',
    price: 4.0,
    stock: 18,
  },
  {
    name: 'Sausage Roll',
    category: 'Pastry',
    description: 'Seasoned pork in golden puff pastry.',
    price: 3.75,
    stock: 20,
  },
  {
    name: 'Bagel with Cream Cheese',
    category: 'Pastry',
    description: 'Toasted plain bagel and whipped cream cheese.',
    price: 3.5,
    stock: 22,
  },
  {
    name: 'Chocolate Chip Cookie',
    category: 'Pastry',
    description: 'Brown-butter cookie with dark chocolate chunks.',
    price: 1.95,
    stock: 48,
  },
  {
    name: 'Macaron Box',
    category: 'Pastry',
    description: 'Six assorted macarons in a gift box.',
    price: 6.5,
    stock: 10,
  },
];

async function seed() {
  // Keep Nest's bootstrap chatter quiet; the script prints its own summary.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const categoriesService = app.get(CategoriesService);
    const productsService = app.get(ProductsService);

    // Resolve category name -> id, creating any that are missing.
    const categories = await categoriesService.findAll();
    const categoryIds = new Map<string, number>(
      categories.map((c) => [c.name.toLowerCase(), c.id]),
    );

    for (const name of new Set(PRODUCTS.map((p) => p.category))) {
      if (!categoryIds.has(name.toLowerCase())) {
        const created = await categoriesService.create({ name });
        categoryIds.set(name.toLowerCase(), created.id);
        console.log(`  + category "${name}"`);
      }
    }

    // Skip anything already in the catalog (match on name, case-insensitive).
    const existing = new Set(
      (await productsService.findAll()).map((p) => p.name.toLowerCase()),
    );

    let created = 0;
    let skipped = 0;

    for (const item of PRODUCTS) {
      if (existing.has(item.name.toLowerCase())) {
        skipped++;
        continue;
      }

      const categoryId = categoryIds.get(item.category.toLowerCase());
      if (!categoryId) {
        console.warn(`  ! no category for "${item.name}" — skipped`);
        skipped++;
        continue;
      }

      await productsService.create({
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId,
        discountPercent: item.discountPercent ?? 0,
        isAvailable: true,
        // Sized drinks keep stock on their variants; sizeless items use `stock`.
        sizes: item.sizes ?? null,
        stock: item.sizes ? 0 : (item.stock ?? 0),
      });
      created++;
    }

    console.log(
      `Seed complete — ${created} created, ${skipped} already present ` +
        `(${PRODUCTS.length} defined).`,
    );
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  new Logger('Seed').error(err instanceof Error ? err.message : err);
  process.exit(1);
});
