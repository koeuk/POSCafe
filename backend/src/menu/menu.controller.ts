import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // Public: customers view the menu by scanning a QR — no login required.
  @Public()
  @Get()
  getMenu() {
    return this.menuService.getMenu();
  }

  // Public: single product detail for the customer detail page.
  @Public()
  @Get('product/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getProduct(id);
  }
}
