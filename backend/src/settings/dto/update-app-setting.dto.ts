import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateAppSettingDto {
  // Trim before validation so a whitespace-only name (e.g. "   ") is rejected
  // by MinLength instead of slipping through and being stored as empty.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  appName?: string;

  // Accept a URL string, or null to clear the logo back to the default mark.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  // KHR per 1 USD (e.g. 4100).
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  khrPerUsd?: number;
}
