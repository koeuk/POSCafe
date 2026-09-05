import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemExtraDto {
  @IsInt()
  inventoryItemId: number;

  // Amount per drink, in the recipe line's unit (15 for "15 g" of sugar).
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateOrderItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  // Required when the product has size options (e.g. "S" | "M" | "L").
  @IsOptional()
  @IsString()
  size?: string;

  // Free-text preparation note, e.g. "less sugar, no ice".
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  // Customer's-choice add-ons from the product's recipe (optional lines).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemExtraDto)
  extras?: OrderItemExtraDto[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
