import { Transform } from 'class-transformer';
import {
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// A hex colour, or null to reset that surface back to its default.
const HexColorOrNull = () => (target: object, key: string) => {
  ValidateIf((_, value) => value !== null)(target, key);
  IsOptional()(target, key);
  IsHexColor()(target, key);
};

export class UpdateAppSettingDto {
  // Trim before validation so a whitespace-only name (e.g. "   ") is rejected
  // by MinLength instead of slipping through and being stored as empty.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  appName?: string;

  // Accept a URL string, or null to clear the logo back to the default mark.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @HexColorOrNull()
  buttonColor?: string | null;

  @HexColorOrNull()
  pageBg?: string | null;

  @HexColorOrNull()
  sidebarBg?: string | null;

  @HexColorOrNull()
  sidebarActiveColor?: string | null;

  @HexColorOrNull()
  buttonColorDark?: string | null;

  @HexColorOrNull()
  pageBgDark?: string | null;

  @HexColorOrNull()
  sidebarBgDark?: string | null;

  @HexColorOrNull()
  sidebarActiveColorDark?: string | null;
}
