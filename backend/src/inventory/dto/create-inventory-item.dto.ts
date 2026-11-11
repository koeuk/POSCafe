import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string; // 'Raw Materials' | 'Packaging' | 'Operating Supplies' | custom

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
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
