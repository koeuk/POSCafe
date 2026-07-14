import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateAppSettingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  appName?: string;

  // Accept a URL string, or null to clear the logo back to the default mark.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  logoUrl?: string | null;
}
