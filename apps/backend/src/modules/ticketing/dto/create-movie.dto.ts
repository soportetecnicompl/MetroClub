import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMovieDto {
  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  durationMin!: number;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  language?: string;
}
