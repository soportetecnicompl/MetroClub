import { Injectable } from '@nestjs/common';
import { TicketQrService } from '../ticketing/ticket-qr.service';

const NAMESPACE = 'voucher:';

/**
 * Reutiliza la firma HMAC de TicketQrService (el mecanismo es idéntico), pero con un
 * namespace propio — así un QR de voucher B2B nunca se confunde con (ni se acepta como)
 * un QR de boleto real, aunque ambos usen el mismo secreto.
 */
@Injectable()
export class VoucherQrService {
  constructor(private readonly ticketQr: TicketQrService) {}

  sign(voucherId: string): string {
    return this.ticketQr.sign(`${NAMESPACE}${voucherId}`);
  }

  verify(token: string): { valid: boolean; voucherId?: string } {
    const { valid, ticketId } = this.ticketQr.verify(token);
    if (!valid || !ticketId?.startsWith(NAMESPACE)) return { valid: false };
    return { valid: true, voucherId: ticketId.slice(NAMESPACE.length) };
  }
}
