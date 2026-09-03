import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string; // 'packaging' | 'ingredient' | 'other'

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
