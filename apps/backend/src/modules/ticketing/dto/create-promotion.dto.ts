import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PromotionScope, PromotionType, TicketFormat } from '@prisma/client';

export class CreatePromotionDto {
  @IsString()
  name!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsEnum(PromotionScope)
  scope!: PromotionScope;

  @IsOptional()
  @IsString()
  movieId?: string;

  @IsOptional()
  @IsEnum(TicketFormat)
  format?: TicketFormat;

  @IsOptional()
  @IsString()
  complexId?: string;

  @IsOptional()
  @IsBoolean()
  requiresMetroClub?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
