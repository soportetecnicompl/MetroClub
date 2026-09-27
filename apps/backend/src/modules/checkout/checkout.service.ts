import { BadRequestException, Injectable } from '@nestjs/common';
import { BoxOfficeService } from '../ticketing/box-office.service';
import { ConcessionsService } from '../concessions/concessions.service';
import { ConfirmCombinedSaleDto } from './dto/confirm-combined-sale.dto';

/**
 * Cobro combinado: el cajero puede vender boleto(s) y confitería en una sola acción,
 * en vez de tener que hacer dos ventas separadas (lo que pedía el negocio). Reutiliza
 * BoxOfficeService.confirmSale y ConcessionsService.sellProducts tal cual — cada una
 * sigue siendo atómica dentro de su propio dominio (butacas vs. inventario), pero ya
 * no hace falta repetir la identificación del cliente ni cobrar dos veces.
 *
 * Nota de diseño: no comparten una única transacción de BD entre boletos y confitería
 * (dominios distintos — asientos vs. inventario). Si el boleto se vende pero la
 * confitería falla después (ej. sin stock), el boleto ya vendido queda válido y el
 * error deja claro qué parte sí se cobró, para que el cajero solo reintente esa parte.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly boxOfficeService: BoxOfficeService,
    private readonly concessionsService: ConcessionsService,
  ) {}

  async confirmCombinedSale(dto: ConfirmCombinedSaleDto) {
    if (!dto.ticket && !dto.concessions) {
      throw new BadRequestException('Debe incluir al menos un boleto o un producto de confitería');
    }

    const tickets = dto.ticket
      ? await this.boxOfficeService.confirmSale({
          showtimeId: dto.ticket.showtimeId,
          seatIds: dto.ticket.seatIds,
          acceptedRisk: dto.ticket.acceptedRisk,
          clientId: dto.clientId,
          channel: dto.channel,
        })
      : [];

    let concessionSale = null;
    if (dto.concessions) {
      try {
        concessionSale = await this.concessionsService.sellProducts({
          complexId: dto.complexId,
          clientId: dto.clientId,
          channel: dto.channel,
          items: dto.concessions.items,
        });
      } catch (error) {
        if (tickets.length > 0) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          throw new BadRequestException(
            `Los ${tickets.length} boleto(s) ya se vendieron correctamente, pero la confitería falló: ${message}. Cobra la confitería por separado o reintenta solo esa parte.`,
          );
        }
        throw error;
      }
    }

    const ticketsTotal = tickets.reduce((sum, ticket) => sum + Number(ticket.price), 0);
    const concessionsTotal = concessionSale ? Number(concessionSale.total) : 0;

    return {
      tickets,
      concessionSale,
      grandTotal: ticketsTotal + concessionsTotal,
    };
  }
}
