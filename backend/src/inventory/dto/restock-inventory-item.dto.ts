import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class RestockInventoryItemDto {
  // Positive number to add, negative to correct/subtract
  @IsNumber()
  delta: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  reason?: string;
}
