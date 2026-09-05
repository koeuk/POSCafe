import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeItemDto {
  @IsNumber()
  inventoryItemId: number;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  // Unit the quantity is in; defaults to the inventory item's unit. Must be
  // in the same family as the item's unit (g/kg, ml/L, pcs).
  @IsString()
  @IsOptional()
  unit?: string | null;

  // Customer's choice: offered at checkout instead of always deducted.
  @IsBoolean()
  @IsOptional()
  optional?: boolean;
}

export class CreateRecipeDto {
  @IsNumber()
  productId: number;

  @IsString()
  @IsOptional()
  size?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items: RecipeItemDto[];
}
