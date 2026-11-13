import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class StockHistoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 25;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  inventoryItemId?: number;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;
  @IsIn(['all', 'in', 'out'])
  @IsOptional()
  direction: 'all' | 'in' | 'out' = 'all';
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  from?: string;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  to?: string;
}
