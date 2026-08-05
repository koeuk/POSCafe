import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
}

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
