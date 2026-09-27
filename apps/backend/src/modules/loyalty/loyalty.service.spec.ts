import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: {
    loyaltyRule: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      loyaltyRule: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new LoyaltyService(prisma as never);
  });

  describe('calculateEarnings', () => {
    it('calcula sellos y puntos según la regla activa (RF-06/RF-07)', async () => {
      prisma.loyaltyRule.findFirst.mockResolvedValue({
        stampsPerVisit: 1,
        pointsPerCurrency: 1,
        currencyUnit: 10,
      });

      const result = await service.calculateEarnings(35);

      expect(result).toEqual({ stampsEarned: 1, pointsEarned: 3 });
    });

    it('lanza NotFoundException si no hay una regla activa', async () => {
      prisma.loyaltyRule.findFirst.mockResolvedValue(null);

      await expect(service.calculateEarnings(10)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('redeemReward', () => {
    const buildTx = (client: { stamps: number; points: number }, reward: Record<string, unknown>) => ({
      client: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(client),
        update: jest.fn().mockResolvedValue(client),
      },
      reward: { findUniqueOrThrow: jest.fn().mockResolvedValue(reward) },
      redemption: { create: jest.fn().mockResolvedValue({ id: 'redemption-1' }) },
    });

    it('canjea un premio cuando el cliente tiene sellos suficientes (RF-10)', async () => {
      const tx = buildTx({ stamps: 5, points: 0 }, { id: 'reward-1', stampsCost: 5, pointsCost: null });
      prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

      const result = await service.redeemReward('client-1', 'reward-1');

      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { stamps: { decrement: 5 }, points: { decrement: 0 } },
      });
      expect(result).toEqual({ id: 'redemption-1' });
    });

    it('rechaza el canje si el cliente no tiene sellos suficientes', async () => {
      const tx = buildTx({ stamps: 2, points: 0 }, { id: 'reward-1', stampsCost: 5, pointsCost: null });
      prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

      await expect(service.redeemReward('client-1', 'reward-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
