import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BoxOfficeService } from './box-office.service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('BoxOfficeService', () => {
  let service: BoxOfficeService;
  let prisma: {
    showtime: { findUniqueOrThrow: jest.Mock };
    seat: { findMany: jest.Mock };
    seatHold: { create: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    client: { findUnique: jest.Mock };
    ticket: {
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let ticketQr: { sign: jest.Mock; verify: jest.Mock };
  let promotions: { getApplicablePromotion: jest.Mock };

  beforeEach(() => {
    prisma = {
      showtime: { findUniqueOrThrow: jest.fn() },
      seat: { findMany: jest.fn() },
      seatHold: { create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
      client: { findUnique: jest.fn() },
      ticket: {
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    ticketQr = { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() };
    promotions = { getApplicablePromotion: jest.fn().mockResolvedValue(null) };
    service = new BoxOfficeService(prisma as never, ticketQr as never, promotions as never);
  });

  describe('holdSeat', () => {
    it('reserva la butaca directamente cuando no existe conflicto', async () => {
      prisma.seatHold.create.mockResolvedValue({ id: 'hold-1', status: 'HELD' });

      const result = await service.holdSeat('showtime-1', 'seat-1', 'staff-1');

      expect(prisma.seatHold.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ showtimeId: 'showtime-1', seatId: 'seat-1', heldBy: 'staff-1' }) }),
      );
      expect(result).toEqual({ id: 'hold-1', status: 'HELD' });
    });

    it('reclama una reserva vencida o liberada cuando la fila única ya existe', async () => {
      prisma.seatHold.create.mockRejectedValue(uniqueConstraintError());
      prisma.seatHold.updateMany.mockResolvedValue({ count: 1 });
      prisma.seatHold.findUniqueOrThrow.mockResolvedValue({ id: 'hold-1', status: 'HELD' });

      const result = await service.holdSeat('showtime-1', 'seat-1', 'staff-2');

      // Nunca debe reclamar una butaca ya vendida (CONVERTED) — solo RELEASED o HELD vencido.
      expect(prisma.seatHold.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ status: 'RELEASED' }, { status: 'HELD', expiresAt: { lt: expect.any(Date) } }],
          }),
        }),
      );
      expect(result).toEqual({ id: 'hold-1', status: 'HELD' });
    });

    it('rechaza la reserva si la butaca sigue vigente o ya fue vendida (no se pudo reclamar)', async () => {
      prisma.seatHold.create.mockRejectedValue(uniqueConstraintError());
      prisma.seatHold.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.holdSeat('showtime-1', 'seat-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirmSale', () => {
    const baseShowtime = {
      id: 'showtime-1',
      movieId: 'movie-1',
      complexId: 'complex-1',
      format: 'D2',
      status: 'SCHEDULED',
      minSalesThreshold: null,
      minSalesDeadlineMinutesBefore: null,
      startsAt: new Date(Date.now() + 3_600_000),
      priceRule: { price: 100 },
    };

    it('vende sin descuento cuando no hay cliente MetroClub', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(baseShowtime);
      prisma.seatHold.updateMany.mockResolvedValue({ count: 1 });
      prisma.ticket.create.mockImplementation((args) => Promise.resolve({ id: args.data.id, ...args.data }));

      const [ticket] = await service.confirmSale({
        showtimeId: 'showtime-1',
        seatIds: ['seat-1'],
        channel: 'BOX_OFFICE',
      } as never);

      expect(ticket.price).toBe(100);
      expect(ticket.discountApplied).toBe(0);
    });

    it('aplica la promoción del motor automáticamente cuando el cliente está identificado', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(baseShowtime);
      prisma.client.findUnique.mockResolvedValue({ id: 'client-1' });
      prisma.seatHold.updateMany.mockResolvedValue({ count: 1 });
      prisma.ticket.create.mockImplementation((args) => Promise.resolve({ id: args.data.id, ...args.data }));
      promotions.getApplicablePromotion.mockResolvedValue({
        promotion: { id: 'promo-1' },
        discountApplied: 10,
      });

      const [ticket] = await service.confirmSale({
        showtimeId: 'showtime-1',
        seatIds: ['seat-1'],
        clientId: 'client-1',
        channel: 'BOX_OFFICE',
      } as never);

      // El motor decidió 10 de descuento sobre 100 — sin ningún paso manual del cajero.
      expect(promotions.getApplicablePromotion).toHaveBeenCalledWith(
        { isMetroClub: true, movieId: 'movie-1', format: 'D2', complexId: 'complex-1' },
        100,
      );
      expect(ticket.discountApplied).toBe(10);
      expect(ticket.price).toBe(90);
      expect(ticket.promotionId).toBe('promo-1');
    });

    it('exige aceptar el riesgo si la función está por debajo del mínimo dentro de la ventana', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue({
        ...baseShowtime,
        startsAt: new Date(Date.now() + 3 * 3_600_000), // función en 3h
        minSalesThreshold: 20,
        minSalesDeadlineMinutesBefore: 120, // se evalúa 2h antes -> faltan 60min para esa evaluación, sigue en riesgo
      });

      await expect(
        service.confirmSale({ showtimeId: 'showtime-1', seatIds: ['seat-1'], channel: 'BOX_OFFICE' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza la venta si alguna butaca ya no estaba reservada al momento de confirmar (condición de carrera)', async () => {
      prisma.showtime.findUniqueOrThrow.mockResolvedValue(baseShowtime);
      prisma.seatHold.updateMany.mockResolvedValue({ count: 1 }); // pidió 2, solo se pudo convertir 1

      await expect(
        service.confirmSale({ showtimeId: 'showtime-1', seatIds: ['seat-1', 'seat-2'], channel: 'BOX_OFFICE' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('scanTicket', () => {
    it('marca el boleto como usado cuando el QR es válido y estaba vigente', async () => {
      ticketQr.verify.mockReturnValue({ valid: true, ticketId: 'ticket-1' });
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 'ticket-1', status: 'USED' });

      const result = await service.scanTicket('valid-token');

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: 'ticket-1', status: 'ISSUED' },
        data: expect.objectContaining({ status: 'USED' }),
      });
      expect(result).toEqual({ id: 'ticket-1', status: 'USED' });
    });

    it('rechaza un QR con firma inválida sin consultar la base de datos', async () => {
      ticketQr.verify.mockReturnValue({ valid: false });

      await expect(service.scanTicket('token-forjado')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un boleto ya usado con un mensaje claro (no un genérico "no encontrado")', async () => {
      ticketQr.verify.mockReturnValue({ valid: true, ticketId: 'ticket-1' });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', status: 'USED' });

      await expect(service.scanTicket('valid-token')).rejects.toBeInstanceOf(ConflictException);
    });

    it('lanza NotFoundException si el ticketId de la firma no corresponde a ningún boleto', async () => {
      ticketQr.verify.mockReturnValue({ valid: true, ticketId: 'ticket-fantasma' });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.scanTicket('valid-token')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listTickets', () => {
    it('filtra por complejo y devuelve lo más reciente primero', async () => {
      prisma.ticket.findMany.mockResolvedValue([{ id: 'ticket-2' }, { id: 'ticket-1' }]);

      const result = await service.listTickets({ complexId: 'complex-1' });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ complexId: 'complex-1' }),
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      );
      expect(result).toEqual([{ id: 'ticket-2' }, { id: 'ticket-1' }]);
    });
  });
});
