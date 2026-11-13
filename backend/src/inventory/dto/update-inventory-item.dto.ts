import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryItemDto } from './create-inventory-item.dto';

export class UpdateInventoryItemDto extends PartialType(
  CreateInventoryItemDto,
) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  adjustmentReason?: string;
}
