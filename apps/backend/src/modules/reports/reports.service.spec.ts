import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    client: { count: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    visit: { count: jest.Mock; groupBy: jest.Mock };
    redemption: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    reward: { findMany: jest.Mock };
    whatsAppMessage: { count: jest.Mock };
    complex: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      client: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
      visit: { count: jest.fn(), groupBy: jest.fn() },
      redemption: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      reward: { findMany: jest.fn() },
      whatsAppMessage: { count: jest.fn() },
      complex: { findMany: jest.fn() },
    };
    service = new ReportsService(prisma as never);
  });

  describe('getDashboardSummary', () => {
    it('calcula retención, promedio de visitas y el costo/pasivo del programa (RF-17)', async () => {
      prisma.client.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      prisma.visit.count.mockResolvedValue(25);
      prisma.redemption.count.mockResolvedValue(4);
      prisma.whatsAppMessage.count.mockResolvedValue(6);
      prisma.visit.groupBy
        .mockResolvedValueOnce([
          { clientId: 'c1', _count: 3 },
          { clientId: 'c2', _count: 1 },
          { clientId: 'c3', _count: 2 },
        ])
        .mockResolvedValueOnce([{ complexId: 'complex-1', _count: 20 }]);
      prisma.complex.findMany.mockResolvedValue([{ id: 'complex-1', name: 'Cinépolis City Mall' }]);
      prisma.redemption.findMany.mockResolvedValue([
        { reward: { monetaryValue: 150 } },
        { reward: { monetaryValue: 80 } },
        { reward: { monetaryValue: null } },
      ]);
      prisma.client.aggregate.mockResolvedValue({ _sum: { points: 340, stamps: 58 } });
      prisma.redemption.groupBy.mockResolvedValue([{ rewardId: 'reward-1', _count: 3 }]);
      prisma.reward.findMany.mockResolvedValue([{ id: 'reward-1', name: 'Entrada 2D gratis' }]);

      const result = await service.getDashboardSummary();

      expect(result.activeClients).toBe(10);
      expect(result.newClientsThisMonth).toBe(2);
      expect(result.retentionRate).toBe(67); // 2 de 3 clientes con >=2 visitas
      expect(result.avgVisitsPerClient).toBe(2.5); // 25 visitas / 10 clientes
      expect(result.topComplexes).toEqual([{ complexId: 'complex-1', name: 'Cinépolis City Mall', visits: 20 }]);
      // Cuánto le ha costado el programa al negocio y cuánto "debe" en sellos/puntos sin canjear.
      expect(result.totalRedemptionCost).toBe(230);
      expect(result.pointsOutstanding).toBe(340);
      expect(result.stampsOutstanding).toBe(58);
      expect(result.topRewards).toEqual([{ rewardId: 'reward-1', name: 'Entrada 2D gratis', redemptions: 3 }]);
    });

    it('no falla cuando no hay visitas ni canjes registrados', async () => {
      prisma.client.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.visit.count.mockResolvedValue(0);
      prisma.redemption.count.mockResolvedValue(0);
      prisma.whatsAppMessage.count.mockResolvedValue(0);
      prisma.visit.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.complex.findMany.mockResolvedValue([]);
      prisma.redemption.findMany.mockResolvedValue([]);
      prisma.client.aggregate.mockResolvedValue({ _sum: { points: null, stamps: null } });
      prisma.redemption.groupBy.mockResolvedValue([]);
      prisma.reward.findMany.mockResolvedValue([]);

      const result = await service.getDashboardSummary();

      expect(result.retentionRate).toBe(0);
      expect(result.avgVisitsPerClient).toBe(0);
      expect(result.totalRedemptionCost).toBe(0);
      expect(result.pointsOutstanding).toBe(0);
      expect(result.stampsOutstanding).toBe(0);
    });
  });

  describe('listClients', () => {
    it('pagina y busca por nombre/whatsapp', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Ana', stamps: 3, points: 40 }]);
      prisma.client.count.mockResolvedValue(1);

      const result = await service.listClients({ search: 'Ana', page: 2, limit: 10 });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({ data: [{ id: 'client-1', name: 'Ana', stamps: 3, points: 40 }], total: 1, page: 2, limit: 10 });
    });
  });

  describe('listRedemptions', () => {
    it('devuelve el listado paginado junto con el costo total (L.) de los canjes filtrados', async () => {
      prisma.redemption.findMany
        .mockResolvedValueOnce([{ id: 'redemption-1' }])
        .mockResolvedValueOnce([{ reward: { monetaryValue: 150 } }]);
      prisma.redemption.count.mockResolvedValue(1);

      const result = await service.listRedemptions({ page: 1, limit: 20 });

      expect(result).toEqual({ data: [{ id: 'redemption-1' }], total: 1, page: 1, limit: 20, totalCost: 150 });
    });
  });
});
