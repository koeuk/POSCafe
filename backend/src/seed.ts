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
 * per-size ProductVariant rows are generated the same way the admin UI
 * would create them.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { CategoriesService } from './categories/categories.service';
import { ProductsService } from './products/products.service';
import { UsersService } from './users/users.service';
import { Role } from './common/enums/role.enum';

interface SeedSize {
  size: string;
  price: number;
}

interface SeedProduct {
  name: string;
  category: string;
  description: string;
  /** Base price. For sized items this mirrors the smallest size. */
  price: number;
  discountPercent?: number;
  /** Size options (price only — sizes never carry stock). */
  sizes?: SeedSize[];
  /** 'recipe' = made to order from consumables; default 'count'. */
  stockMode?: 'count' | 'recipe';
  /** Units on hand for a counted product. */
  stock?: number;
}

/** S/M/L ladder: +$0.50 per step up, matching the existing catalog. */
function sml(base: number): SeedSize[] {
  return [
    { size: 'S', price: round(base) },
    { size: 'M', price: round(base + 0.5) },
    { size: 'L', price: round(base + 1.0) },
  ];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// One demo product per category, so every screen has something to show
// without burying a real shop's own catalog under dozens of fixtures:
//  - Iced Latte: sized drink MADE TO ORDER from consumables (see recipes below)
//  - Jasmine Tea: sized drink with one counted stock figure
//  - Almond Croissant: sizeless item with a counted stock figure
const PRODUCTS: SeedProduct[] = [
  {
    name: 'Iced Latte',
    category: 'Espresso',
    description: 'Chilled milk and espresso poured over ice.',
    price: 3.75,
    sizes: [
      { size: 'M', price: 3.75 },
      { size: 'L', price: 4.25 },
    ],
    stockMode: 'recipe',
  },
  {
    name: 'Jasmine Tea',
    category: 'Tea',
    description: 'Green tea layered with fresh jasmine blossom.',
    price: 2.75,
    sizes: sml(2.75),
    stock: 100,
  },
  {
    name: 'Almond Croissant',
    category: 'Pastry',
    description: 'Twice-baked croissant filled with almond cream.',
    price: 3.25,
    stock: 24,
  },
];

import { InventoryService } from './inventory/inventory.service';
import { RecipesService } from './recipes/recipes.service';

// Supplies in the three groups a café keeps: raw materials that go into
// drinks, packaging that leaves with the order, and operating supplies used
// in the shop. Cup / lid sizes are separate items because their usage and
// remaining counts differ.
const RAW = 'Raw Materials';
const PACK = 'Packaging';
const OPS = 'Operating Supplies';
const item = (
  name: string,
  category: string,
  unit: string,
  stockQuantity: number,
  minThreshold: number,
) => ({ name, category, unit, stockQuantity, minThreshold });

const DEMO_INVENTORY_ITEMS = [
  // ☕ Raw materials
  item('Coffee Bean', RAW, 'g', 10000, 1000),
  item('Fresh Milk', RAW, 'ml', 20000, 2000),
  item('Condensed Milk', RAW, 'ml', 5000, 500),
  item('Sugar', RAW, 'g', 5000, 500),
  item('Vanilla Syrup', RAW, 'ml', 3000, 500),
  item('Caramel Syrup', RAW, 'ml', 2000, 300),
  item('Chocolate Powder', RAW, 'g', 2000, 300),
  item('Matcha', RAW, 'g', 1000, 200),
  item('Tea', RAW, 'g', 2000, 300),
  item('Ice', RAW, 'g', 50000, 5000),
  // 🥤 Packaging
  item('Cup M', PACK, 'pcs', 500, 50),
  item('Cup L', PACK, 'pcs', 300, 30),
  item('Lid M', PACK, 'pcs', 450, 50),
  item('Lid L', PACK, 'pcs', 280, 30),
  item('Straw', PACK, 'pcs', 700, 100),
  item('Plastic Bag', PACK, 'pcs', 500, 50),
  item('Paper Bag', PACK, 'pcs', 200, 30),
  item('Tissue', PACK, 'pcs', 1000, 100),
  // 🧹 Operating supplies
  item('Dishwashing Liquid', OPS, 'ml', 5000, 500),
  item('Gloves', OPS, 'pcs', 200, 20),
  item('Trash Bags', OPS, 'pcs', 100, 10),
];

// Iced Latte M, exactly as the shop makes it; L scales the drink up and
// swaps the cup and lid. Quantities are per one drink sold.
const ICED_LATTE_RECIPES: Record<string, [string, number][]> = {
  M: [
    ['Coffee Bean', 18],
    ['Fresh Milk', 120],
    ['Condensed Milk', 20],
    ['Sugar', 10],
    ['Cup M', 1],
    ['Lid M', 1],
    ['Straw', 1],
    ['Ice', 150],
  ],
  L: [
    ['Coffee Bean', 22],
    ['Fresh Milk', 160],
    ['Condensed Milk', 25],
    ['Sugar', 12],
    ['Cup L', 1],
    ['Lid L', 1],
    ['Straw', 1],
    ['Ice', 200],
  ],
};

async function seed() {
  // Keep Nest's bootstrap chatter quiet; the script prints its own summary.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const categoriesService = app.get(CategoriesService);
    const productsService = app.get(ProductsService);
    const inventoryService = app.get(InventoryService);
    const recipesService = app.get(RecipesService);
    const usersService = app.get(UsersService);

    // `npm run seed -- --only=categories` (or SEED_ONLY=categories)
    const categoriesOnly =
      process.argv.includes('--only=categories') ||
      process.env.SEED_ONLY === 'categories';

    // 0. Seed or Reset Default Users (admin & cashier)
    let adminUser = await usersService.findByUsername('admin');
    if (!adminUser) {
      adminUser = await usersService.createUser({
        name: 'Admin User',
        username: 'admin',
        password: '12345678',
        role: Role.ADMIN,
      });
      console.log(
        '  + Admin user created (username: admin, password: 12345678)',
      );
    } else {
      await usersService.setPassword(adminUser.id, '12345678');
      console.log('  + Admin password updated to: 12345678');
    }

    let cashierUser = await usersService.findByUsername('cashier');
    if (!cashierUser) {
      cashierUser = await usersService.createUser({
        name: 'Cashier Staff',
        username: 'cashier',
        password: '12345678',
        role: Role.CASHIER,
      });
      console.log(
        '  + Cashier user created (username: cashier, password: 12345678)',
      );
    } else {
      await usersService.setPassword(cashierUser.id, '12345678');
      console.log('  + Cashier password updated to: 12345678');
    }

    // 1. Seed product categories (the menu's top-level groups). With
    //    `--only=categories` the script stops here — useful after a reset when
    //    the shop will enter its own products and supplies.
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

    if (categoriesOnly) {
      console.log(
        `Seed complete — categories only (${categoryIds.size} present).`,
      );
      return;
    }

    // 2. Seed inventory items (cups, lids, straws, raw ingredients)
    const existingInventory = await inventoryService.findAll();
    const inventoryMap = new Map<string, number>();
    for (const item of existingInventory) {
      inventoryMap.set(item.name.toLowerCase(), item.id);
    }

    // Existing demo items that sit at zero (fresh reset, or emptied by tests)
    // get their demo quantity back as a journaled restock, so re-running the
    // seed always leaves the demo recipes sellable.
    let invCreated = 0;
    let invRestocked = 0;
    for (const item of DEMO_INVENTORY_ITEMS) {
      const existingId = inventoryMap.get(item.name.toLowerCase());
      if (existingId === undefined) {
        const created = await inventoryService.create(item);
        inventoryMap.set(item.name.toLowerCase(), created.id);
        invCreated++;
        continue;
      }
      const existing = existingInventory.find((i) => i.id === existingId)!;
      if (existing.category !== item.category) {
        await inventoryService.update(existingId, { category: item.category });
      }
      if (Number(existing.stockQuantity) <= 0 && item.stockQuantity > 0) {
        await inventoryService.restock(existingId, adminUser.id, {
          delta: item.stockQuantity,
          reason: 'seed',
        });
        invRestocked++;
      }
    }
    console.log(
      `  + Inventory items seeded (${invCreated} created, ${invRestocked} restocked)`,
    );

    // 3. Seed Products
    const existingProducts = await productsService.findAll();

    let created = 0;
    let skipped = 0;
    let restocked = 0;

    for (const item of PRODUCTS) {
      const existing = existingProducts.find(
        (p) => p.name.toLowerCase() === item.name.toLowerCase(),
      );
      if (existing) {
        skipped++;
        // Put the demo stock back on a counted product that has none left
        // (made-to-order products sell from consumables instead).
        if (
          existing.stockMode === 'count' &&
          existing.stock <= 0 &&
          (item.stock ?? 0) > 0
        ) {
          await productsService.update(
            existing.id,
            { stock: item.stock },
            adminUser.id,
          );
          restocked++;
        }
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
        sizes: item.sizes ?? null,
        stockMode: item.stockMode ?? 'count',
        stock: item.stock ?? 0,
      });
      created++;
    }

    // 4. Seed the demo recipes for Iced Latte (M / L)
    const allProducts = await productsService.findAll();
    const icedLatte = allProducts.find(
      (p) => p.name.toLowerCase() === 'iced latte',
    );
    if (icedLatte) {
      let seeded = 0;
      for (const [size, lines] of Object.entries(ICED_LATTE_RECIPES)) {
        if (!icedLatte.variants.some((v) => v.size === size)) continue;
        const items = lines
          .map(([name, quantity]) => ({
            inventoryItemId: inventoryMap.get(name.toLowerCase()),
            quantity,
          }))
          .filter(
            (l): l is { inventoryItemId: number; quantity: number } =>
              l.inventoryItemId !== undefined,
          );
        if (items.length !== lines.length) continue;
        await recipesService.createOrUpdate(
          { productId: icedLatte.id, size, items },
          adminUser.id,
        );
        seeded++;
      }
      console.log(`  + Recipes seeded for Iced Latte (${seeded} sizes)`);
    }

    console.log(
      `Seed complete — ${created} created, ${skipped} already present, ` +
        `${restocked} restocked (${PRODUCTS.length} defined).`,
    );
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  new Logger('Seed').error(err instanceof Error ? err.message : err);
  process.exit(1);
});
