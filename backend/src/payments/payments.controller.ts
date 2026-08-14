import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KhqrService } from './khqr.service';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly khqrService: KhqrService,
  ) {}

  // The shop's reusable KHQR for the printable counter poster. Declared before
  // the ':orderId' route below so "static" isn't parsed as an order id.
  @RequiresPage('qr', 'payments')
  @Get('khqr/static')
  staticKhqr() {
    return this.khqrService.staticQr();
  }

  // The KHQR the customer scans for this order (amount already embedded).
  @RequiresPage('payments')
  @Get('khqr/:orderId')
  khqr(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.khqrService.forOrder(orderId);
  }

  // Taking and reading payments happens on the Take Payment screen.
  @RequiresPage('payments')
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @RequiresPage('payments')
  @Get('order/:orderId')
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.findByOrder(orderId);
  }
}
