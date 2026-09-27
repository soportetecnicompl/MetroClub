import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CorporateService } from './corporate.service';

describe('CorporateService', () => {
  let service: CorporateService;
  let prisma: {
    ticketBatch: { create: jest.Mock; findMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    voucher: { createMany: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
    showtime: { findUniqueOrThrow: jest.Mock };
    seatHold: { updateMany: jest.Mock };
    ticket: { create: jest.Mock };
    corporateAccount: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let ticketQr: { sign: jest.Mock };
  let voucherQr: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    prisma = {
      ticketBatch: { create: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
      voucher: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      showtime: { findUniqueOrThrow: jest.fn() },
      seatHold: { updateMany: jest.fn() },
      ticket: { create: jest.fn() },
      corporateAccount: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    ticketQr = { sign: jest.fn().mockReturnValue('ticket-signed-token') };
    voucherQr = { sign: jest.fn((id: string) => `voucher-signed.${id}`), verify: jest.fn() };
    service = new CorporateService(prisma as never, ticketQr as never, voucherQr as never);
  });

  describe('createBatch', () => {
    it('crea el lote y genera un voucher firmado por cada boleto solicitado', async () => {
      prisma.ticketBatch.create.mockResolvedValue({ id: 'batch-1' });
      prisma.voucher.createMany.mockResolvedValue({ count: 3 });
      prisma.ticketBatch.findUniqueOrThrow.mockResolvedValue({ id: 'batch-1', vouchers: [] });

      await service.createBatch({ corporateAccountId: 'corp-1', complexId: 'complex-1', quantity: 3 } as never);

      expect(prisma.voucher.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ batchId: 'batch-1' })]),
        }),
      );
      const data = prisma.voucher.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(3);
      expect(new Set(data.map((v: { id: string }) => v.id)).size).toBe(3); // ids únicos
    });
  });

  describe('listBatches', () => {
    it('calcula redimidos/anulados/restantes a partir del estado de cada voucher', async () => {
      prisma.ticketBatch.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          corporateAccount: { name: 'Empresa A' },
          complex: { name: 'Sala Piloto' },
          quantity: 10,
          note: null,
          expiresAt: null,
          createdAt: new Date(),
          vouchers: [
            { status: 'REDEEMED' },
            { status: 'REDEEMED' },
            { status: 'VOID' },
            { status: 'ISSUED' },
            { status: 'ISSUED' },
          ],
        },
      ]);

      const [batch] = await service.listBatches();

      expect(batch.redeemed).toBe(2);
      expect(batch.voided).toBe(1);
      expect(batch.remaining).toBe(7); // 10 - 2 redimidos - 1 anulado
    });
  });

  describe('redeemVoucher', () => {
    const dto = { qrToken: 'token', showtimeId: 'showtime-1', seatId: 'seat-1' };

    it('canjea el voucher: quema el voucher, convierte la butaca y emite un boleto sin costo', async () => {
      voucherQr.verify.mockReturnValue({ valid: true, voucherId: 'voucher-1' });
      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', batch: { expiresAt: null } });
      prisma.showtime.findUniqueOrThrow.mockResolvedValue({ id: 'showtime-1', status: 'SCHEDULED', complexId: 'complex-1' });
      prisma.voucher.updateMany.mockResolvedValue({ count: 1 });
      prisma.seatHold.updateMany.mockResolvedValue({ count: 1 });
      prisma.ticket.create.mockImplementation((args) => Promise.resolve({ id: args.data.id, ...args.data }));
      prisma.voucher.update.mockResolvedValue({});

      const ticket = await service.redeemVoucher(dto as never);

      expect(ticket.price).toBe(0);
      expect(ticket.channel).toBe('CORPORATE');
      expect(prisma.voucher.updateMany).toHaveBeenCalledWith({
        where: { id: 'voucher-1', status: 'ISSUED' },
        data: expect.objectContaining({ status: 'REDEEMED' }),
      });
      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
        data: { redeemedTicketId: ticket.id },
      });
    });

    it('rechaza un QR con firma inválida sin consultar la base de datos', async () => {
      voucherQr.verify.mockReturnValue({ valid: false });

      await expect(service.redeemVoucher(dto as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.voucher.findUnique).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el voucher no existe', async () => {
      voucherQr.verify.mockReturnValue({ valid: true, voucherId: 'fantasma' });
      prisma.voucher.findUnique.mockResolvedValue(null);

      await expect(service.redeemVoucher(dto as never)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza un voucher de un lote ya vencido', async () => {
      voucherQr.verify.mockReturnValue({ valid: true, voucherId: 'voucher-1' });
      prisma.voucher.findUnique.mockResolvedValue({
        id: 'voucher-1',
        batch: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(service.redeemVoucher(dto as never)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el voucher ya fue canjeado o anulado (condición de carrera)', async () => {
      voucherQr.verify.mockReturnValue({ valid: true, voucherId: 'voucher-1' });
      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', batch: { expiresAt: null } });
      prisma.showtime.findUniqueOrThrow.mockResolvedValue({ id: 'showtime-1', status: 'SCHEDULED', complexId: 'complex-1' });
      prisma.voucher.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.redeemVoucher(dto as never)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.seatHold.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza si la butaca ya no está reservada (se venció o alguien más la tomó)', async () => {
      voucherQr.verify.mockReturnValue({ valid: true, voucherId: 'voucher-1' });
      prisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', batch: { expiresAt: null } });
      prisma.showtime.findUniqueOrThrow.mockResolvedValue({ id: 'showtime-1', status: 'SCHEDULED', complexId: 'complex-1' });
      prisma.voucher.updateMany.mockResolvedValue({ count: 1 });
      prisma.seatHold.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.redeemVoucher(dto as never)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('voidVoucher', () => {
    it('anula un voucher que sigue sin canjear', async () => {
      prisma.voucher.updateMany.mockResolvedValue({ count: 1 });
      prisma.voucher.findUniqueOrThrow.mockResolvedValue({ id: 'voucher-1', status: 'VOID' });

      const result = await service.voidVoucher('voucher-1');

      expect(result.status).toBe('VOID');
    });

    it('rechaza anular un voucher ya canjeado', async () => {
      prisma.voucher.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.voidVoucher('voucher-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
