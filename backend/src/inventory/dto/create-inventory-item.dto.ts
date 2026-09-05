import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string; // free-form grouping, e.g. 'Packaging', 'Ingredient'

  @IsString()
  @IsNotEmpty()
  unit: string; // 'pcs', 'g', 'ml', 'kg', 'L'

  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPerUnit?: number;
}
