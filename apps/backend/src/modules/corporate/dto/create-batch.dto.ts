import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  corporateAccountId!: string;

  @IsString()
  complexId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
