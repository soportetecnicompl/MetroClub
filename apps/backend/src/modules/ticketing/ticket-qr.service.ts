import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Firma el token del QR de un boleto (HMAC) — a diferencia del token opaco de
 * Boletos-Metrocinemas (aleatorio + unicidad en BD), aquí el escáner puede rechazar de
 * inmediato un token forjado/corrupto sin ni siquiera consultar la base de datos. El
 * estado real (usado/vigente) SIEMPRE se valida contra la fila en BD con un UPDATE
 * atómico — la firma es una capa extra de defensa, no un reemplazo de esa validación.
 */
@Injectable()
export class TicketQrService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('TICKET_QR_SECRET') ?? 'dev-ticket-qr-secret-cambiar-en-produccion';
  }

  sign(ticketId: string): string {
    const signature = crypto.createHmac('sha256', this.secret()).update(ticketId).digest('base64url');
    return `${ticketId}.${signature}`;
  }

  /** Solo verifica la firma — no confirma que el boleto exista ni siga vigente. */
  verify(token: string): { valid: boolean; ticketId?: string } {
    const separatorIndex = token.lastIndexOf('.');
    if (separatorIndex <= 0) return { valid: false };

    const ticketId = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    const expected = crypto.createHmac('sha256', this.secret()).update(ticketId).digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    const valid =
      signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    return valid ? { valid: true, ticketId } : { valid: false };
  }
}
