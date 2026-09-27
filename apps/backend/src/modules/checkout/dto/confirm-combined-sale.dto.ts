import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalesChannel } from '@prisma/client';

class TicketPartDto {
  @IsString()
  showtimeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seatIds!: string[];

  @IsOptional()
  @IsBoolean()
  acceptedRisk?: boolean;
}

class ConcessionItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class ConcessionsPartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConcessionItemDto)
  items!: ConcessionItemDto[];
}

/**
 * Cobro combinado en una sola acción de taquilla: boleto(s) + confitería, cada parte
 * opcional (para poder seguir cobrando solo boleto o solo confitería desde la misma
 * pantalla). Antes el cajero tenía que hacer dos ventas separadas para lo mismo.
 */
export class ConfirmCombinedSaleDto {
  @IsString()
  complexId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsEnum(SalesChannel)
  channel!: SalesChannel;

  @IsOptional()
  @ValidateNested()
  @Type(() => TicketPartDto)
  ticket?: TicketPartDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConcessionsPartDto)
  concessions?: ConcessionsPartDto;
}
