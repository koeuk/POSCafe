import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Any authenticated user (cashier) can create an order.
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(userId, dto);
  }

  // Optional filters: ?status=pending  and  ?mine=true (only my orders).
  @Get()
  findAll(
    @CurrentUser('id') userId: number,
    @Query('status') status?: OrderStatus,
    @Query('mine') mine?: string,
  ) {
    return this.ordersService.findAll({
      status,
      userId: mine === 'true' ? userId : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
