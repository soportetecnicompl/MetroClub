import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreateLoyaltyRuleDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  stampsPerVisit!: number;

  @IsNumber()
  @Min(0)
  pointsPerCurrency!: number;

  @IsNumber()
  @Min(0.01)
  currencyUnit!: number;
}
