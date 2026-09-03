import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class RestockInventoryItemDto {
  // Positive number to add, negative to correct/subtract
  @IsNumber()
  delta: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
