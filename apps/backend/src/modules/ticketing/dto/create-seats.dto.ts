import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { SeatType } from '@prisma/client';

class SeatInput {
  @IsString()
  row!: string;

  @IsInt()
  @Min(1)
  number!: number;

  @IsEnum(SeatType)
  type!: SeatType;
}

/** Alta masiva de butacas para una sala (ej. generadas desde un mapa fila x columna en el admin). */
export class CreateSeatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeatInput)
  seats!: SeatInput[];
}
