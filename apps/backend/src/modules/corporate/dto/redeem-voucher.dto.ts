import { IsOptional, IsString } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  qrToken!: string;

  @IsString()
  showtimeId!: string;

  @IsString()
  seatId!: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}
