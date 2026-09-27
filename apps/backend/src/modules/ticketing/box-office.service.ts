import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, SalesChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketQrService } from './ticket-qr.service';
import { PromotionsService } from './promotions.service';
import { ConfirmSaleDto } from './dto/confirm-sale.dto';

const HOLD_TTL_SECONDS = 5 * 60;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** RF de boletería: reserva y venta de boletos en taquilla, con candado atómico de butacas. */
@Injectable()
export class BoxOfficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketQr: TicketQrService,
    private readonly promotions: PromotionsService,
  ) {}

  /** ¿Esta función todavía puede cancelarse por no alcanzar el mínimo? Si sí, hay que
   * mostrarle el aviso de riesgo al comprador antes de dejarlo pagar. */
  private isAtRisk(showtime: {
    status: string;
    minSalesThreshold: number | null;
    minSalesDeadlineMinutesBefore: number | null;
    startsAt: Date;
  }): boolean {
    if (showtime.status !== 'SCHEDULED' && showtime.status !== 'AT_RISK') return false;
    if (showtime.minSalesThreshold == null || showtime.minSalesDeadlineMinutesBefore == null) return false;
    const deadline = new Date(showtime.startsAt.getTime() - showtime.minSalesDeadlineMinutesBefore * 60_000);
    return new Date() < deadline;
  }

  /** Butacas de la sala de una función + su estado actual (libre/reservada/vendida). */
  async getSeatMap(showtimeId: string) {
    const showtime = await this.prisma.showtime.findUniqueOrThrow({
      where: { id: showtimeId },
      include: { priceRule: true, movie: true, screen: true },
    });

    const now = new Date();
    const [seats, holds, soldCount] = await Promise.all([
      this.prisma.seat.findMany({ where: { screenId: showtime.screenId, isActive: true }, orderBy: [{ row: 'asc' }, { number: 'asc' }] }),
      this.prisma.seatHold.findMany({ where: { showtimeId } }),
      this.prisma.ticket.count({ where: { showtimeId, status: { in: ['ISSUED', 'USED'] } } }),
    ]);

    const holdBySeat = new Map(holds.map((h) => [h.seatId, h]));

    const seatMap = seats.map((seat) => {
      const hold = holdBySeat.get(seat.id);
      let status: 'AVAILABLE' | 'HELD' | 'SOLD' = 'AVAILABLE';
      if (hold?.status === 'CONVERTED') status = 'SOLD';
      else if (hold?.status === 'HELD' && hold.expiresAt > now) status = 'HELD';

      return { seatId: seat.id, row: seat.row, number: seat.number, type: seat.type, status };
    });

    return {
      showtimeId,
      movie: showtime.movie.title,
      screen: showtime.screen.name,
      startsAt: showtime.startsAt,
      format: showtime.format,
      price: showtime.priceRule ? Number(showtime.priceRule.price) : null,
      soldCount,
      isAtRisk: this.isAtRisk(showtime),
      seats: seatMap,
    };
  }

  /**
   * Reserva atómica de una butaca — mismo patrón validado en Boletos-Metrocinemas
   * (UPDATE/CREATE condicionado por estado, sin transacciones ni locks manuales). Si la
   * fila única ya existe pero está vencida o liberada, se "reclama"; si está VIGENTE o
   * ya se vendió (CONVERTED), se rechaza — nunca se reclama una butaca ya vendida.
   */
  async holdSeat(showtimeId: string, seatId: string, heldBy?: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_SECONDS * 1000);

    try {
      return await this.prisma.seatHold.create({
        data: { showtimeId, seatId, heldBy, expiresAt },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;

      const reclaimed = await this.prisma.seatHold.updateMany({
        where: {
          showtimeId,
          seatId,
          OR: [{ status: 'RELEASED' }, { status: 'HELD', expiresAt: { lt: now } }],
        },
        data: { status: 'HELD', heldBy, expiresAt },
      });

      if (reclaimed.count === 0) {
        throw new ConflictException('Esa butaca ya está reservada o vendida');
      }
      return this.prisma.seatHold.findUniqueOrThrow({ where: { showtimeId_seatId: { showtimeId, seatId } } });
    }
  }

  /** Libera una reserva manualmente (el cajero deselecciona la butaca antes de cobrar). */
  async releaseHold(showtimeId: string, seatId: string) {
    const result = await this.prisma.seatHold.updateMany({
      where: { showtimeId, seatId, status: 'HELD' },
      data: { status: 'RELEASED' },
    });
    if (result.count === 0) {
      throw new NotFoundException('No hay una reserva activa para esa butaca');
    }
  }

  /**
   * Confirma la venta: convierte las reservas HELD en boletos ISSUED. Si viene clientId,
   * busca la promoción más conveniente aplicable (motor de promociones) y la aplica.
   */
  async confirmSale(dto: ConfirmSaleDto) {
    const showtime = await this.prisma.showtime.findUniqueOrThrow({
      where: { id: dto.showtimeId },
      include: { priceRule: true },
    });

    if (showtime.status === 'CANCELLED') {
      throw new BadRequestException('Esta función fue cancelada');
    }
    if (!showtime.priceRule) {
      throw new BadRequestException('Esta función no tiene un precio configurado');
    }
    if (this.isAtRisk(showtime) && !dto.acceptedRisk) {
      throw new BadRequestException(
        'Esta función aún no alcanza el mínimo de asistentes y podría cambiar de horario — el comprador debe aceptar el riesgo antes de pagar',
      );
    }

    const client = dto.clientId
      ? await this.prisma.client.findUnique({ where: { id: dto.clientId, isDeleted: false } })
      : null;
    if (dto.clientId && !client) {
      throw new NotFoundException('Cliente MetroClub no encontrado');
    }

    const basePrice = Number(showtime.priceRule.price);
    const match = await this.promotions.getApplicablePromotion(
      {
        isMetroClub: Boolean(client),
        movieId: showtime.movieId,
        format: showtime.format,
        complexId: showtime.complexId,
      },
      basePrice,
    );
    const discountApplied = match?.discountApplied ?? 0;
    const finalPrice = basePrice - discountApplied;

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.seatHold.updateMany({
        where: { showtimeId: dto.showtimeId, seatId: { in: dto.seatIds }, status: 'HELD', expiresAt: { gt: now } },
        data: { status: 'CONVERTED' },
      });

      if (claimed.count !== dto.seatIds.length) {
        throw new ConflictException(
          'Una o más butacas ya no están reservadas (se venció la reserva o alguien más la tomó) — vuelve a intentar',
        );
      }

      const tickets = await Promise.all(
        dto.seatIds.map((seatId) => {
          const ticketId = randomUUID();
          return tx.ticket.create({
            data: {
              id: ticketId,
              showtimeId: dto.showtimeId,
              seatId,
              clientId: client?.id,
              complexId: showtime.complexId,
              price: finalPrice,
              discountApplied,
              promotionId: match?.promotion.id,
              channel: dto.channel,
              qrToken: this.ticketQr.sign(ticketId),
              riskAcceptedAt: dto.acceptedRisk ? now : null,
            },
          });
        }),
      );

      return tickets;
    });
  }

  /** Escaneo en sala: valida la firma del QR y marca el boleto como usado de forma atómica. */
  async scanTicket(qrToken: string) {
    const { valid, ticketId } = this.ticketQr.verify(qrToken);
    if (!valid || !ticketId) {
      throw new BadRequestException('Código QR inválido o corrupto');
    }

    const result = await this.prisma.ticket.updateMany({
      where: { id: ticketId, status: 'ISSUED' },
      data: { status: 'USED', usedAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!existing) throw new NotFoundException('Boleto no encontrado');
      throw new ConflictException(`Este boleto ya fue usado o no está vigente (estado: ${existing.status})`);
    }

    return this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { showtime: { include: { movie: true } }, seat: true, client: true },
    });
  }

  /** Libera reservas vencidas — higiene periódica (la disponibilidad ya se calcula bien sin esto). */
  async releaseExpiredHolds() {
    const result = await this.prisma.seatHold.updateMany({
      where: { status: 'HELD', expiresAt: { lt: new Date() } },
      data: { status: 'RELEASED' },
    });
    return { released: result.count };
  }

  /** Historial de boletos vendidos — para la pantalla de ventas realizadas. */
  listTickets(params: { complexId?: string; from?: Date; to?: Date }) {
    return this.prisma.ticket.findMany({
      where: {
        complexId: params.complexId,
        createdAt: {
          gte: params.from,
          lte: params.to,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        showtime: { include: { movie: true, screen: true } },
        seat: true,
        client: true,
        promotion: true,
      },
    });
  }
}
