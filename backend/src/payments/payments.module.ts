import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { KhqrService } from './khqr.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, KhqrService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
