import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  DEFAULT_CASHIER_PAGES,
  RequiresPage,
} from '../common/decorators/requires-page.decorator';
import { Role } from '../common/enums/role.enum';
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

  // Fields the Stock page actually sends. A user holding 'stock' but not
  // 'products' is a stock-taker, so they may only touch these — otherwise the
  // grant silently becomes full catalog control (rename, re-price, re-category).
  private static readonly STOCK_EDITABLE_FIELDS = ['stock', 'sizes'];

  // Also reachable from the Stock page (quantity/size edits), so 'stock' grants
  // it too — not just full 'products' catalog access.
  @RequiresPage('products', 'stock')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!ProductsController.hasFullCatalogAccess(user)) {
      const forbidden = Object.keys(dto).filter(
        (field) => !ProductsController.STOCK_EDITABLE_FIELDS.includes(field),
      );
      if (forbidden.length > 0) {
        throw new ForbiddenException(
          `Stock access allows editing ${ProductsController.STOCK_EDITABLE_FIELDS.join(
            ' and ',
          )} only; not ${forbidden.join(', ')}`,
        );
      }
    }
    return this.productsService.update(id, dto);
  }

  /** Admins and holders of the 'products' page may edit every field. */
  private static hasFullCatalogAccess(user: AuthUser): boolean {
    // AuthUser.role is the raw string off the JWT, hence the widened compare.
    if (user?.role === (Role.ADMIN as string)) {
      return true;
    }
    const allowed = user?.allowedPages ?? DEFAULT_CASHIER_PAGES;
    return allowed.includes('products');
  }

  // The Stock page can also remove a product, so 'stock' grants delete too.
  @RequiresPage('products', 'stock')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
