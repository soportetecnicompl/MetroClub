import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Showtime } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const REASSIGNMENT_OFFER_VALID_DAYS = 15;

/**
 * Evalúa el mínimo de ventas de cada función y aplica la regla acordada, sin
 * confirmación humana: si al llegar la ventana de evaluación no se alcanzó el mínimo,
 * la función se cancela automáticamente. Metro Cinemas no hace devoluciones en
 * efectivo — cada boleto B2C afectado recibe un código de reasignación, nunca un
 * reembolso.
 */
@Injectable()
export class ShowtimeLifecycleService {
  private readonly logger = new Logger(ShowtimeLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  private evaluationDeadline(showtime: Pick<Showtime, 'startsAt' | 'minSalesDeadlineMinutesBefore'>): Date | null {
    if (showtime.minSalesDeadlineMinutesBefore == null) return null;
    return new Date(showtime.startsAt.getTime() - showtime.minSalesDeadlineMinutesBefore * 60_000);
  }

  /**
   * Recorre las funciones con mínimo configurado que todavía no se resolvieron
   * (SCHEDULED/AT_RISK) y decide: marcar en riesgo, confirmar, o cancelar.
   */
  async evaluateShowtimes() {
    const now = new Date();
    const candidates = await this.prisma.showtime.findMany({
      where: {
        status: { in: ['SCHEDULED', 'AT_RISK'] },
        startsAt: { gt: now },
        minSalesThreshold: { not: null },
        minSalesDeadlineMinutesBefore: { not: null },
      },
    });

    let confirmed = 0;
    let cancelled = 0;
    let flaggedAtRisk = 0;

    for (const showtime of candidates) {
      const soldCount = await this.prisma.ticket.count({
        where: { showtimeId: showtime.id, status: { in: ['ISSUED', 'USED'] } },
      });
      const belowMinimum = soldCount < (showtime.minSalesThreshold ?? 0);
      const deadline = this.evaluationDeadline(showtime);
      const pastDeadline = deadline != null && now >= deadline;

      if (!pastDeadline) {
        if (belowMinimum && showtime.status !== 'AT_RISK') {
          await this.prisma.showtime.update({ where: { id: showtime.id }, data: { status: 'AT_RISK' } });
          flaggedAtRisk += 1;
        }
        continue;
      }

      if (!belowMinimum) {
        await this.prisma.showtime.update({ where: { id: showtime.id }, data: { status: 'CONFIRMED' } });
        confirmed += 1;
        continue;
      }

      await this.cancelShowtime(
        showtime.id,
        `No alcanzó el mínimo de ${showtime.minSalesThreshold} boletos vendidos (llevaba ${soldCount})`,
      );
      cancelled += 1;
    }

    this.logger.debug(
      `evaluateShowtimes: ${candidates.length} evaluadas, ${confirmed} confirmadas, ${cancelled} canceladas, ${flaggedAtRisk} marcadas en riesgo`,
    );
    return { evaluated: candidates.length, confirmed, cancelled, flaggedAtRisk };
  }

  /**
   * Cancela una función (por regla automática o manualmente por comercial — p. ej. para
   * convertirla en evento B2B privado) y genera la oferta de reasignación de cada
   * boleto B2C afectado. Nunca reembolsa: solo reasigna.
   */
  async cancelShowtime(showtimeId: string, reason: string) {
    const showtime = await this.prisma.showtime.findUniqueOrThrow({ where: { id: showtimeId } });
    const now = new Date();

    await this.prisma.showtime.update({
      where: { id: showtimeId },
      data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason },
    });

    // Ya no debería poder venderse nada más de esta función.
    await this.prisma.seatHold.updateMany({ where: { showtimeId, status: 'HELD' }, data: { status: 'RELEASED' } });

    const affectedTickets = await this.prisma.ticket.findMany({
      where: { showtimeId, status: 'ISSUED' },
      include: { client: true },
    });

    const suggestedShowtime = await this.prisma.showtime.findFirst({
      where: {
        movieId: showtime.movieId,
        id: { not: showtimeId },
        status: { in: ['SCHEDULED', 'AT_RISK', 'CONFIRMED'] },
        startsAt: { gt: now },
      },
      orderBy: { startsAt: 'asc' },
    });

    let notified = 0;
    for (const ticket of affectedTickets) {
      await this.prisma.$transaction([
        this.prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CANCELLED' } }),
        this.prisma.ticketReassignmentOffer.create({
          data: {
            ticketId: ticket.id,
            code: randomUUID(),
            suggestedShowtimeId: suggestedShowtime?.id,
            expiresAt: new Date(now.getTime() + REASSIGNMENT_OFFER_VALID_DAYS * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      // Solo se puede notificar a boletos de clientes MetroClub identificados (tienen
      // WhatsApp registrado) — un boleto de invitado sin cuenta (venta online sin
      // membresía, todavía no construida) no tiene ningún canal de contacto guardado.
      if (ticket.clientId) {
        await this.whatsappService.queueMessage(ticket.clientId, 'SHOWTIME_CANCELLED', 'showtime_cancelled');
        notified += 1;
      }
    }

    this.logger.debug(
      `cancelShowtime(${showtimeId}): ${affectedTickets.length} boleto(s) afectado(s), ${notified} notificado(s), alternativa sugerida: ${suggestedShowtime?.id ?? 'ninguna'}`,
    );

    return {
      cancelledTicketsCount: affectedTickets.length,
      notifiedCount: notified,
      suggestedShowtimeId: suggestedShowtime?.id ?? null,
    };
  }
}
