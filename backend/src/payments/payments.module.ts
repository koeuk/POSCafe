import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { Payment } from './entities/payment.entity';
import { KhqrService } from './khqr.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), OrdersModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, KhqrService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
