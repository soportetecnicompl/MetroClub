import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

/** Movimientos que un usuario puede disparar a mano — SALE_CONSUMPTION solo lo genera el sistema. */
const MANUAL_MOVEMENT_TYPES = ['PURCHASE', 'ADJUSTMENT', 'WASTE'] as const;

export class AdjustStockDto {
  @IsIn(MANUAL_MOVEMENT_TYPES)
  type!: (typeof MANUAL_MOVEMENT_TYPES)[number];

  /** Siempre positivo — el signo real (entrada/salida) lo decide `type`. */
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
