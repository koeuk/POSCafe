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
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Role } from '../common/enums/role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Orders are created from the POS screen.
  @RequiresPage('pos')
  @Post()
  create(@CurrentUser('id') userId: number, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(userId, dto);
  }

  // Read by the Orders, Order History, Kitchen, Take Payment and Dashboard
  // screens. Optional filters: ?status=pending, ?mine=true (only my orders),
  // ?unpaid=true (orders without a payment yet — for the Take Payment screen).
  @RequiresPage('orders', 'order-history', 'kitchen', 'payments', 'dashboard')
  @Get()
  findAll(
    @CurrentUser('id') userId: number,
    @Query('status') status?: OrderStatus,
    @Query('mine') mine?: string,
    @Query('unpaid') unpaid?: string,
  ) {
    return this.ordersService.findAll({
      status,
      userId: mine === 'true' ? userId : undefined,
      unpaid: unpaid === 'true',
    });
  }

  // Viewing a single order: same access as viewing the list.
  @RequiresPage('orders', 'order-history', 'kitchen', 'payments')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  // Status changes come from the Orders, Order History and Kitchen screens.
  @RequiresPage('orders', 'order-history', 'kitchen')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // Refunding reverses money already taken, so it stays admin-only.
  @Roles(Role.ADMIN)
  @Post(':id/refund')
  refund(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ordersService.refund(id, user.id);
  }
}
