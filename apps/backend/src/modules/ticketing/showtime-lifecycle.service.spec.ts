import { ShowtimeLifecycleService } from './showtime-lifecycle.service';

describe('ShowtimeLifecycleService', () => {
  let service: ShowtimeLifecycleService;
  let prisma: {
    showtime: { findMany: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock; findFirst: jest.Mock };
    ticket: { count: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    seatHold: { updateMany: jest.Mock };
    ticketReassignmentOffer: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let whatsappService: { queueMessage: jest.Mock };

  beforeEach(() => {
    prisma = {
      showtime: { findMany: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn(), findFirst: jest.fn() },
      ticket: { count: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      seatHold: { updateMany: jest.fn() },
      ticketReassignmentOffer: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    whatsappService = { queueMessage: jest.fn().mockResolvedValue({ id: 'message-1' }) };
    service = new ShowtimeLifecycleService(prisma as never, whatsappService as never);
  });

  describe('evaluateShowtimes', () => {
    const showtimeBase = { id: 'showtime-1', movieId: 'movie-1', minSalesThreshold: 20 };

    it('marca AT_RISK una función por debajo del mínimo que todavía no llega a su ventana de evaluación', async () => {
      prisma.showtime.findMany.mockResolvedValue([
        { ...showtimeBase, status: 'SCHEDULED', startsAt: new Date(Date.now() + 3 * 3_600_000), minSalesDeadlineMinutesBefore: 120 },
      ]);
      prisma.ticket.count.mockResolvedValue(3); // muy por debajo de 20

      const result = await service.evaluateShowtimes();

      expect(prisma.showtime.update).toHaveBeenCalledWith({ where: { id: 'showtime-1' }, data: { status: 'AT_RISK' } });
      expect(result).toEqual({ evaluated: 1, confirmed: 0, cancelled: 0, flaggedAtRisk: 1 });
    });

    it('confirma la función si ya pasó la ventana de evaluación y sí alcanzó el mínimo', async () => {
      prisma.showtime.findMany.mockResolvedValue([
        { ...showtimeBase, status: 'AT_RISK', startsAt: new Date(Date.now() + 30 * 60_000), minSalesDeadlineMinutesBefore: 120 },
      ]);
      prisma.ticket.count.mockResolvedValue(25);

      const result = await service.evaluateShowtimes();

      expect(prisma.showtime.update).toHaveBeenCalledWith({ where: { id: 'showtime-1' }, data: { status: 'CONFIRMED' } });
      expect(result.confirmed).toBe(1);
      expect(result.cancelled).toBe(0);
    });

    it('cancela automáticamente (sin confirmación humana) si pasó la ventana sin alcanzar el mínimo', async () => {
      const showtime = { ...showtimeBase, status: 'AT_RISK', startsAt: new Date(Date.now() + 30 * 60_000), minSalesDeadlineMinutesBefore: 120 };
      prisma.showtime.findMany.mockResolvedValue([showtime]);
      prisma.ticket.count.mockResolvedValue(3);
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(showtime);
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.showtime.findFirst.mockResolvedValue(null);

      const result = await service.evaluateShowtimes();

      expect(prisma.showtime.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'showtime-1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
      expect(result.cancelled).toBe(1);
    });
  });

  describe('cancelShowtime', () => {
    const showtime = { id: 'showtime-1', movieId: 'movie-1' };

    it('libera reservas vivas, cancela cada boleto ISSUED y genera su oferta de reasignación (nunca un reembolso)', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(showtime);
      prisma.ticket.findMany.mockResolvedValue([
        { id: 'ticket-1', clientId: 'client-1' },
        { id: 'ticket-2', clientId: null }, // boleto de invitado, sin canal de contacto todavía
      ]);
      prisma.showtime.findFirst.mockResolvedValue({ id: 'showtime-alterna' });

      const result = await service.cancelShowtime('showtime-1', 'No alcanzó el mínimo');

      expect(prisma.showtime.update).toHaveBeenCalledWith({
        where: { id: 'showtime-1' },
        data: expect.objectContaining({ status: 'CANCELLED', cancelReason: 'No alcanzó el mínimo' }),
      });
      expect(prisma.seatHold.updateMany).toHaveBeenCalledWith({
        where: { showtimeId: 'showtime-1', status: 'HELD' },
        data: { status: 'RELEASED' },
      });
      expect(prisma.ticket.update).toHaveBeenCalledWith({ where: { id: 'ticket-1' }, data: { status: 'CANCELLED' } });
      expect(prisma.ticketReassignmentOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ticketId: 'ticket-1', suggestedShowtimeId: 'showtime-alterna' }),
        }),
      );
      // Solo se notifica al boleto con cliente MetroClub identificado (tiene WhatsApp).
      expect(whatsappService.queueMessage).toHaveBeenCalledTimes(1);
      expect(whatsappService.queueMessage).toHaveBeenCalledWith('client-1', 'SHOWTIME_CANCELLED', 'showtime_cancelled');
      expect(result).toEqual({ cancelledTicketsCount: 2, notifiedCount: 1, suggestedShowtimeId: 'showtime-alterna' });
    });

    it('no sugiere ninguna función alterna si no hay otra próxima de la misma película', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(showtime);
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.showtime.findFirst.mockResolvedValue(null);

      const result = await service.cancelShowtime('showtime-1', 'Conversión a evento privado B2B');

      expect(result.suggestedShowtimeId).toBeNull();
    });
  });
});
