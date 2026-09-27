import { IsDateString, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class EnrollClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsPhoneNumber()
  whatsapp!: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
