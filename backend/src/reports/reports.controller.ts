import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Reports are admin-only.
  @Roles(Role.ADMIN)
  @Get('summary')
  summary() {
    return this.reportsService.summary();
  }

  @Roles(Role.ADMIN)
  @Get('daily-sales')
  dailySales(@Query('days') days?: string) {
    return this.reportsService.dailySales(days ? Number(days) : 7);
  }

  @Roles(Role.ADMIN)
  @Get('best-products')
  bestProducts(@Query('limit') limit?: string) {
    return this.reportsService.bestProducts(limit ? Number(limit) : 5);
  }

  @Roles(Role.ADMIN)
  @Get('stock')
  stock() {
    return this.reportsService.stock();
  }

  @Roles(Role.ADMIN)
  @Get('categories')
  categories() {
    return this.reportsService.categorySales();
  }
}
