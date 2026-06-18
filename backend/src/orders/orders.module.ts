import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { OrdersService } from './orders.service';

@Module({
  // AuthModule gives the gateway a JwtService to verify socket tokens.
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
