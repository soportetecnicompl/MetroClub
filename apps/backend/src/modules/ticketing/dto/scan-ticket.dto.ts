import { IsString } from 'class-validator';

export class ScanTicketDto {
  @IsString()
  qrToken!: string;
}
