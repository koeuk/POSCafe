import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // null clears the avatar; a string sets it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  avatar?: string | null;

  // Sidebar pages a cashier may see (ignored for admins).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPages?: string[];
}
