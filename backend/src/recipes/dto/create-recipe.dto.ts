import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
