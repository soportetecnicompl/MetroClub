import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateLoyaltyRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stampsPerVisit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerCurrency?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  currencyUnit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
