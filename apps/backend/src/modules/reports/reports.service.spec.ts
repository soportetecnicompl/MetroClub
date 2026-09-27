import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    client: { count: jest.Mock; findMany: jest.Mock };
    visit: { count: jest.Mock; groupBy: jest.Mock };
    redemption: { count: jest.Mock };
    whatsAppMessage: { count: jest.Mock };
    complex: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      client: { count: jest.fn(), findMany: jest.fn() },
      visit: { count: jest.fn(), groupBy: jest.fn() },
      redemption: { count: jest.fn() },
      whatsAppMessage: { count: jest.fn() },
      complex: { findMany: jest.fn() },
    };
    service = new ReportsService(prisma as never);
  });

  describe('getDashboardSummary', () => {
    it('calcula retención y promedio de visitas (RF-17)', async () => {
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

      const result = await service.getDashboardSummary();

      expect(result.activeClients).toBe(10);
      expect(result.newClientsThisMonth).toBe(2);
      expect(result.retentionRate).toBe(67); // 2 de 3 clientes con >=2 visitas
      expect(result.avgVisitsPerClient).toBe(2.5); // 25 visitas / 10 clientes
      expect(result.topComplexes).toEqual([{ complexId: 'complex-1', name: 'Cinépolis City Mall', visits: 20 }]);
    });

    it('no falla cuando no hay visitas registradas', async () => {
      prisma.client.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.visit.count.mockResolvedValue(0);
      prisma.redemption.count.mockResolvedValue(0);
      prisma.whatsAppMessage.count.mockResolvedValue(0);
      prisma.visit.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.complex.findMany.mockResolvedValue([]);

      const result = await service.getDashboardSummary();

      expect(result.retentionRate).toBe(0);
      expect(result.avgVisitsPerClient).toBe(0);
    });
  });
});
