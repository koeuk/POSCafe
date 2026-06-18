import { Controller, Get } from '@nestjs/common';
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
}
