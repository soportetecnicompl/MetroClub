import { IsOptional, IsString } from 'class-validator';

export class CreateComplexDto {
  @IsString()
  name!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
