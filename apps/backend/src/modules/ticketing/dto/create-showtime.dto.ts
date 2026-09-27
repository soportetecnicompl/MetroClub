import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TicketFormat } from '@prisma/client';

export class CreateShowtimeDto {
  @IsString()
  movieId!: string;

  @IsString()
  screenId!: string;

  @IsString()
  complexId!: string;

  @IsEnum(TicketFormat)
  format!: TicketFormat;

  @IsOptional()
  @IsString()
  priceRuleId?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSalesThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSalesDeadlineMinutesBefore?: number;
}
