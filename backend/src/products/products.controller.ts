import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Optional ?categoryId= filter; reads open to any authenticated user.
  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.productsService.findAll(
      categoryId ? Number(categoryId) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @RequiresPage('products')
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // Also reachable from the Stock page (quantity/size edits), so 'stock' grants
  // it too — not just full 'products' catalog access.
  @RequiresPage('products', 'stock')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  // The Stock page can also remove a product, so 'stock' grants delete too.
  @RequiresPage('products', 'stock')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
