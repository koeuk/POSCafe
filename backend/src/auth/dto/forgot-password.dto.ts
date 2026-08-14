import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  /** Username or email address — staff know one or the other. */
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
