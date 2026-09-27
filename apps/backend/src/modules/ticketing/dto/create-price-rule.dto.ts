import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { TicketFormat } from '@prisma/client';

export class CreatePriceRuleDto {
  @IsString()
  complexId!: string;

  @IsEnum(TicketFormat)
  format!: TicketFormat;

  @IsNumber()
  @Min(0)
  price!: number;
}
