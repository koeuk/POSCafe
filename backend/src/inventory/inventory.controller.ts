import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { User } from '../users/entities/user.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

// Consumables are managed from the Inventory page, so — like product stock —
// a cashier granted that page may count, restock and edit them.
@RequiresPage('stock')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // The POS needs this list too: the checkout add-ons dialog offers every
  // supply, not just the ones a recipe marks optional.
  @RequiresPage('stock', 'pos')
  @Get()
  findAll(@Query('category') category?: string) {
    return this.inventoryService.findAll(category);
  }

  @Get('low-stock')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get('movements')
  findMovements(@Query('limit') limit?: string) {
    return this.inventoryService.findMovements(limit ? Number(limit) : 50);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(id, dto, user.id);
  }

  // `?force=true` also strips the item out of any recipe that uses it.
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force?: string,
  ) {
    return this.inventoryService.remove(id, force === 'true');
  }

  @Post(':id/restock')
  restock(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: RestockInventoryItemDto,
  ) {
    return this.inventoryService.restock(id, user.id, dto);
  }
}
