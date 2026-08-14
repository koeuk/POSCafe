import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyResetCodeDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
