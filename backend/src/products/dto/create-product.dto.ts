import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { STOCK_MODES, type StockMode } from '../entities/product.entity';

export class ProductSizeDto {
  @IsString()
  @IsNotEmpty()
  size: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique((s: ProductSizeDto) => s.size, {
    message: 'Duplicate size names are not allowed',
  })
  @ValidateNested({ each: true })
  @Type(() => ProductSizeDto)
  sizes?: ProductSizeDto[] | null;

  // Percentage off the price (0-100). Defaults to 0 (no discount).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[] | null;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // 'count' (default): `stock` is the units on hand. 'recipe': made to
  // order from consumables; `stock` is ignored.
  @IsOptional()
  @IsIn(STOCK_MODES)
  stockMode?: StockMode;

  // Units on hand ('count' products only).
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsInt()
  categoryId: number;
}
