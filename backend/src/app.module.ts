import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env lives at the project root; also support a local backend/.env.
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'poscafe'),
        autoLoadEntities: true,
        // Schema changes go through migrations (src/migrations), applied
        // automatically on boot. DB_SYNCHRONIZE=true remains as an escape
        // hatch for throwaway databases — it can silently drop columns, so
        // never enable it against real data.
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        migrations: [`${__dirname}/migrations/*{.ts,.js}`],
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') !== 'false',
      }),
    }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
