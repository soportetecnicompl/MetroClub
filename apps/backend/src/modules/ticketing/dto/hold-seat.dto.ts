import { IsOptional, IsString } from 'class-validator';

export class HoldSeatDto {
  @IsString()
  seatId!: string;

  /** userId del cajero, o un identificador de sesión para el flujo online. */
  @IsOptional()
  @IsString()
  heldBy?: string;
}
