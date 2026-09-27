import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
