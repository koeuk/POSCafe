import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { SizesModule } from './sizes/sizes.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

import { InventoryModule } from './inventory/inventory.module';
import { RecipesModule } from './recipes/recipes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env lives at the project root; also support a local backend/.env.
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    MenuModule,
    PaymentsModule,
    ReportsModule,
    SettingsModule,
    SizesModule,
    UploadsModule,
    InventoryModule,
    RecipesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
