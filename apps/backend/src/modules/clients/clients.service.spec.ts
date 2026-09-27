import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    client: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    visit: { create: jest.Mock };
    redemption: { findMany: jest.Mock };
    whatsAppMessage: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let loyaltyService: { calculateEarnings: jest.Mock };
  let walletService: { issuePasses: jest.Mock; pushUpdate: jest.Mock };
  let whatsappService: { schedulePostVisitMessage: jest.Mock };

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      visit: { create: jest.fn() },
      redemption: { findMany: jest.fn() },
      whatsAppMessage: { findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    loyaltyService = { calculateEarnings: jest.fn() };
    walletService = { issuePasses: jest.fn(), pushUpdate: jest.fn() };
    whatsappService = { schedulePostVisitMessage: jest.fn() };

    service = new ClientsService(
      prisma as never,
      loyaltyService as never,
      walletService as never,
      whatsappService as never,
    );
  });

  describe('enroll', () => {
    it('crea un cliente nuevo y emite sus wallet passes (RF-02/RF-03)', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      const created = { id: 'client-1', name: 'Ana', whatsapp: '+50499999999' };
      prisma.client.create.mockResolvedValue(created);

      const result = await service.enroll({ name: 'Ana', whatsapp: '+50499999999' });

      expect(prisma.client.create).toHaveBeenCalled();
      expect(walletService.issuePasses).toHaveBeenCalledWith('client-1');
      expect(result).toEqual(created);
    });

    it('no vuelve a pedir datos si el cliente ya existe (RF-04)', async () => {
      const existing = { id: 'client-1', name: 'Ana', whatsapp: '+50499999999' };
      prisma.client.findUnique.mockResolvedValue(existing);

      const result = await service.enroll({ name: 'Ana', whatsapp: '+50499999999' });

      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(walletService.issuePasses).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });
  });

  describe('registerVisit', () => {
    it('suma sellos/puntos, refresca el wallet pass y agenda el WhatsApp post-visita (RF-04/RF-05/RF-11)', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: 'client-1', isDeleted: false });
      loyaltyService.calculateEarnings.mockResolvedValue({ stampsEarned: 1, pointsEarned: 3 });
      prisma.visit.create.mockResolvedValue({ id: 'visit-1' });
      const updatedClient = { id: 'client-1', stamps: 1, points: 3 };
      prisma.client.update.mockResolvedValue(updatedClient);

      const result = await service.registerVisit('client-1', { complexId: 'complex-1', amountSpent: 35 });

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          stamps: { increment: 1 },
          points: { increment: 3 },
          lastVisitAt: expect.any(Date),
        },
      });
      expect(walletService.pushUpdate).toHaveBeenCalledWith('client-1');
      expect(whatsappService.schedulePostVisitMessage).toHaveBeenCalledWith('client-1');
      expect(result).toEqual(updatedClient);
    });

    it('lanza NotFoundException si el cliente no existe o fue borrado', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.registerVisit('client-x', { complexId: 'complex-1' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
