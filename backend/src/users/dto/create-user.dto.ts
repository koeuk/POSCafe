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

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  // Recovery address for the forgot-password OTP. Optional: only accounts that
  // need self-service reset (admins) have to carry one. "" clears it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  // Sidebar pages a cashier may see (ignored for admins). Omit/null = default
  // cashier pages; an empty array is rejected (it would lock the cashier out).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowedPages?: string[];
}
