import { Controller, Get, Query } from '@nestjs/common';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequiresPage('reports')
  @Get('summary')
  summary() {
    return this.reportsService.summary();
  }

  @RequiresPage('reports')
  @Get('daily-sales')
  dailySales(@Query('days') days?: string) {
    return this.reportsService.dailySales(days ? Number(days) : 7);
  }

  @RequiresPage('reports')
  @Get('best-products')
  bestProducts(@Query('limit') limit?: string) {
    return this.reportsService.bestProducts(limit ? Number(limit) : 5);
  }

  // Also used by the Stock page's overview.
  @RequiresPage('stock', 'reports')
  @Get('stock')
  stock() {
    return this.reportsService.stock();
  }

  // Also used by the Dashboard's "Popular Categories" chart.
  @RequiresPage('dashboard', 'reports')
  @Get('categories')
  categories() {
    return this.reportsService.categorySales();
  }
}
