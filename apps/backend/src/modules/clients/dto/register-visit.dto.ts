import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegisterVisitDto {
  @IsString()
  complexId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountSpent?: number;

  @IsOptional()
  @IsString()
  channel?: string;
}
