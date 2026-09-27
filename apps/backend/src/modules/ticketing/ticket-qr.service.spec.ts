import { TicketQrService } from './ticket-qr.service';

describe('TicketQrService', () => {
  let service: TicketQrService;

  beforeEach(() => {
    const config = { get: jest.fn().mockReturnValue('test-secret') };
    service = new TicketQrService(config as never);
  });

  it('firma y verifica un token válido, devolviendo el ticketId original', () => {
    const token = service.sign('ticket-123');
    const result = service.verify(token);

    expect(result).toEqual({ valid: true, ticketId: 'ticket-123' });
  });

  it('rechaza un token con la firma alterada', () => {
    const token = service.sign('ticket-123');
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    expect(service.verify(tampered)).toEqual({ valid: false });
  });

  it('rechaza un token con el ticketId alterado (firma ya no corresponde)', () => {
    const token = service.sign('ticket-123');
    const [, signature] = token.split('.');
    const forged = `ticket-999.${signature}`;

    expect(service.verify(forged)).toEqual({ valid: false });
  });

  it('rechaza tokens sin el formato esperado', () => {
    expect(service.verify('')).toEqual({ valid: false });
    expect(service.verify('sin-punto')).toEqual({ valid: false });
  });

  it('produce firmas distintas para secretos distintos (aislamiento por entorno)', () => {
    const configA = { get: jest.fn().mockReturnValue('secret-a') };
    const configB = { get: jest.fn().mockReturnValue('secret-b') };
    const serviceA = new TicketQrService(configA as never);
    const serviceB = new TicketQrService(configB as never);

    const token = serviceA.sign('ticket-123');

    expect(serviceB.verify(token)).toEqual({ valid: false });
  });
});
