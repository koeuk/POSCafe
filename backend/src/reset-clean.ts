import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './common/enums/role.enum';

async function resetClean() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const usersService = app.get(UsersService);

    console.log('🧹 Clearing all database tables...');

    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'inventory_movements',
      'stock_movements',
      'recipe_items',
      'recipes',
      'inventory_items',
      'order_items',
      'orders',
      'payments',
      'product_variants',
      'products',
      'categories',
      'users',
    ];

    for (const table of tables) {
      await dataSource.query(`TRUNCATE TABLE \`${table}\``);
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(
      '  + All product, order, category, and inventory tables cleared!',
    );

    // Re-create default Admin and Cashier accounts
    await usersService.createUser({
      name: 'Admin User',
      username: 'admin',
      password: '12345678',
      role: Role.ADMIN,
    });
    console.log('  + Default Admin user created (admin / 12345678)');

    await usersService.createUser({
      name: 'Cashier Staff',
      username: 'cashier',
      password: '12345678',
      role: Role.CASHIER,
    });
    console.log('  + Default Cashier user created (cashier / 12345678)');

    console.log(
      '\n✨ Database reset complete! Clean slate with default login accounts.',
    );
  } catch (err) {
    console.error('Failed to reset database:', err);
  } finally {
    await app.close();
  }
}

resetClean();
