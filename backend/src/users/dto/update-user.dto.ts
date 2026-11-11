import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  // null or "" clears the recovery address; a string sets it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // null clears the avatar; a string sets it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  avatar?: string | null;

  // Sidebar pages a cashier may see (ignored for admins). Omit/null = default
  // cashier pages; an empty array is rejected (it would lock the cashier out).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowedPages?: string[];
}
