import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
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

  // End-of-day close: payments by method and cashier for one date.
  @RequiresPage('reports')
  @Get('day-close')
  dayClose(@Query('date') date?: string) {
    return this.reportsService.dayClose(date);
  }

  @RequiresPage('reports')
  @Get('daily-sales')
  dailySales(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.dailySales(days, from, to);
  }

  @RequiresPage('reports')
  @Get('best-products')
  bestProducts(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.reportsService.bestProducts(limit);
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
