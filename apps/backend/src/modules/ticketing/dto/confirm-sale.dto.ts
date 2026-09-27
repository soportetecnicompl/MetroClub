import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { SalesChannel } from '@prisma/client';

export class ConfirmSaleDto {
  @IsString()
  showtimeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seatIds!: string[];

  /** Si viene, se busca al cliente MetroClub y se aplica su descuento automáticamente. */
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsEnum(SalesChannel)
  channel!: SalesChannel;

  /** Requerido si la función está en riesgo (por debajo del mínimo) — ver getSeatMap/status. */
  @IsOptional()
  @IsBoolean()
  acceptedRisk?: boolean;
}
