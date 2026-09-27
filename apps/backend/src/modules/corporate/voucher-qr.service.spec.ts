import { VoucherQrService } from './voucher-qr.service';
import { TicketQrService } from '../ticketing/ticket-qr.service';

describe('VoucherQrService', () => {
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const ticketQr = new TicketQrService(config as never);
  const service = new VoucherQrService(ticketQr);

  it('firma y verifica un voucher redondo (sign -> verify)', () => {
    const token = service.sign('voucher-1');
    expect(service.verify(token)).toEqual({ valid: true, voucherId: 'voucher-1' });
  });

  it('rechaza el QR de un boleto real (namespace distinto) aunque la firma sea válida', () => {
    const ticketToken = ticketQr.sign('ticket-1');

    expect(service.verify(ticketToken)).toEqual({ valid: false });
  });

  it('rechaza un token con firma corrupta', () => {
    const token = service.sign('voucher-1');
    const tampered = token.slice(0, -2) + 'xx';

    expect(service.verify(tampered)).toEqual({ valid: false });
  });
});
