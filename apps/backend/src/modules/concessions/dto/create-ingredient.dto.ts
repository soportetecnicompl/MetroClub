import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  complexId!: string;

  @IsString()
  name!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}
