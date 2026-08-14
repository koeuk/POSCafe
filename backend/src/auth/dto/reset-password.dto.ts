import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** Short-lived token handed back by /auth/verify-reset-code. */
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  // Same 6-character floor as CreateUserDto, so a reset can't set a password
  // weaker than one an admin could type in the staff form.
  @IsString()
  @MinLength(6)
  password: string;
}
