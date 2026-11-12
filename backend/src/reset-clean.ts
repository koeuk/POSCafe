import { NestFactory } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './common/enums/role.enum';

async function resetClean() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const usersService = app.get(UsersService);

    console.log('🧹 Clearing all database tables...');

    // Delete children first; keep foreign-key checks active and roll back as a unit.
    await prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.recipeItem.deleteMany();
      await tx.recipe.deleteMany();
      await tx.inventoryItem.deleteMany();
      await tx.payment.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();
      await tx.productVariant.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.passwordReset.deleteMany();
      await tx.user.deleteMany();
    });
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
