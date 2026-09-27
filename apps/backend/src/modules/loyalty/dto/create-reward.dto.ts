import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  stampsCost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsCost?: number;

  /** Valor en Lempiras del premio (p. ej. el precio de la entrada), para mostrar el ahorro al canjear. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  monetaryValue?: number;
}
