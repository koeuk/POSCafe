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
    sizes: sml(3.75),
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

// Consumables are filed under the same categories as the menu (see the
// Categories page): coffee packaging and ingredients under Espresso, the
// bubble-tea straw under Tea.
const DEMO_INVENTORY_ITEMS = [
  // 🥤 Cups
  {
    name: 'Plastic Cup 12oz',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 500,
    minThreshold: 50,
  },
  {
    name: 'Plastic Cup 16oz',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 800,
    minThreshold: 100,
  },
  {
    name: 'Plastic Cup 22oz',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 300,
    minThreshold: 30,
  },
  {
    name: 'Paper Cup 12oz',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 200,
    minThreshold: 30,
  },
  {
    name: 'Paper Cup 16oz',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 350,
    minThreshold: 50,
  },
  // 🥤 Lids
  {
    name: '12oz Lid',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 500,
    minThreshold: 50,
  },
  {
    name: '16oz Lid',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 800,
    minThreshold: 100,
  },
  {
    name: '22oz Lid',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 300,
    minThreshold: 30,
  },
  // 🥤 Straws
  {
    name: 'Regular Straw',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 1000,
    minThreshold: 100,
  },
  {
    name: 'Big Straw',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 500,
    minThreshold: 50,
  },
  {
    name: 'Paper Straw',
    category: 'Espresso',
    unit: 'pcs',
    stockQuantity: 500,
    minThreshold: 50,
  },
  {
    name: 'Bubble Tea Straw',
    category: 'Tea',
    unit: 'pcs',
    stockQuantity: 300,
    minThreshold: 30,
  },
  // ☕ Raw ingredients
  {
    name: 'Coffee Beans',
    category: 'Espresso',
    unit: 'g',
    stockQuantity: 10000,
    minThreshold: 1000,
  },
  {
    name: 'Fresh Milk',
    category: 'Espresso',
    unit: 'ml',
    stockQuantity: 20000,
    minThreshold: 2000,
  },
  {
    name: 'Sugar Syrup',
    category: 'Espresso',
    unit: 'ml',
    stockQuantity: 8000,
    minThreshold: 1000,
  },
  {
    name: 'Vanilla Syrup',
    category: 'Espresso',
    unit: 'ml',
    stockQuantity: 3000,
    minThreshold: 500,
  },
  {
    name: 'Caramel Drizzle',
    category: 'Espresso',
    unit: 'ml',
    stockQuantity: 2000,
    minThreshold: 300,
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

    // 4. Seed the demo recipe for Iced Latte (S/M/L)
    const allProducts = await productsService.findAll();
    const icedLatte = allProducts.find(
      (p) => p.name.toLowerCase() === 'iced latte',
    );

    if (icedLatte) {
      const beansId = inventoryMap.get('coffee beans');
      const milkId = inventoryMap.get('fresh milk');
      const strawId = inventoryMap.get('regular straw');
      const cup12Id = inventoryMap.get('plastic cup 12oz');
      const lid12Id = inventoryMap.get('12oz lid');
      const cup16Id = inventoryMap.get('plastic cup 16oz');
      const lid16Id = inventoryMap.get('16oz lid');
      const cup22Id = inventoryMap.get('plastic cup 22oz');
      const lid22Id = inventoryMap.get('22oz lid');

      if (beansId && milkId && strawId) {
        // Size S (12oz)
        if (cup12Id && lid12Id) {
          await recipesService
            .createOrUpdate({
              productId: icedLatte.id,
              size: 'S',
              items: [
                { inventoryItemId: beansId, quantity: 15 },
                { inventoryItemId: milkId, quantity: 150 },
                { inventoryItemId: cup12Id, quantity: 1 },
                { inventoryItemId: lid12Id, quantity: 1 },
                { inventoryItemId: strawId, quantity: 1 },
              ],
            })
            .catch(() => null);
        }
        // Size M (16oz)
        if (cup16Id && lid16Id) {
          await recipesService
            .createOrUpdate({
              productId: icedLatte.id,
              size: 'M',
              items: [
                { inventoryItemId: beansId, quantity: 18 },
                { inventoryItemId: milkId, quantity: 200 },
                { inventoryItemId: cup16Id, quantity: 1 },
                { inventoryItemId: lid16Id, quantity: 1 },
                { inventoryItemId: strawId, quantity: 1 },
              ],
            })
            .catch(() => null);
        }
        // Size L (22oz)
        if (cup22Id && lid22Id) {
          await recipesService
            .createOrUpdate({
              productId: icedLatte.id,
              size: 'L',
              items: [
                { inventoryItemId: beansId, quantity: 22 },
                { inventoryItemId: milkId, quantity: 280 },
                { inventoryItemId: cup22Id, quantity: 1 },
                { inventoryItemId: lid22Id, quantity: 1 },
                { inventoryItemId: strawId, quantity: 1 },
              ],
            })
            .catch(() => null);
        }
        console.log('  + Recipes seeded for Iced Latte (S/M/L)');
      }
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
