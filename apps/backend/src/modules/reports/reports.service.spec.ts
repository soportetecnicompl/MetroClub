import { ReportsService, segmentWhere } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    client: { count: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock; findUniqueOrThrow: jest.Mock };
    visit: { count: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock };
    redemption: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
    reward: { findMany: jest.Mock };
    whatsAppMessage: { count: jest.Mock };
    complex: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      client: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), findUniqueOrThrow: jest.fn() },
      visit: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
      redemption: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
      reward: { findMany: jest.fn() },
      whatsAppMessage: { count: jest.fn() },
      complex: { findMany: jest.fn() },
    };
    service = new ReportsService(prisma as never);
  });

  describe('getDashboardSummary', () => {
    it('calcula retención, promedio de visitas, segmentación de la base y el costo/pasivo del programa (RF-17)', async () => {
      // orden real de las llamadas a client.count: activeClients, newClientsThisMonth,
      // 5x segmentCounts (active/at_risk/dormant/lost/never), clientsWithRedemptions.
      prisma.client.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4) // active
        .mockResolvedValueOnce(3) // at_risk
        .mockResolvedValueOnce(2) // dormant
        .mockResolvedValueOnce(1) // lost
        .mockResolvedValueOnce(0) // never
        .mockResolvedValueOnce(6); // clientsWithRedemptions
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
      // Costo real de los canjes: suma de costAtRedemption (precio congelado), no del
      // precio actual del premio.
      prisma.redemption.aggregate.mockResolvedValue({ _sum: { costAtRedemption: 230 } });
      prisma.client.aggregate
        .mockResolvedValueOnce({ _sum: { points: 340, stamps: 58 } })
        .mockResolvedValueOnce({ _sum: { totalSpent: 4500 } });
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
      // A quién "atacar": segmentación por recencia + qué tanto usan el programa + cuánto genera.
      expect(result.clientsBySegment).toEqual({ active: 4, at_risk: 3, dormant: 2, lost: 1, never: 0 });
      expect(result.redemptionRate).toBe(60); // 6 de 10 clientes han canjeado algo
      expect(result.lifetimeRevenue).toBe(4500);
    });

    it('no falla cuando no hay visitas ni canjes registrados', async () => {
      prisma.client.count.mockResolvedValue(0);
      prisma.visit.count.mockResolvedValue(0);
      prisma.redemption.count.mockResolvedValue(0);
      prisma.whatsAppMessage.count.mockResolvedValue(0);
      prisma.visit.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.complex.findMany.mockResolvedValue([]);
      prisma.redemption.aggregate.mockResolvedValue({ _sum: { costAtRedemption: null } });
      prisma.client.aggregate
        .mockResolvedValueOnce({ _sum: { points: null, stamps: null } })
        .mockResolvedValueOnce({ _sum: { totalSpent: null } });
      prisma.redemption.groupBy.mockResolvedValue([]);
      prisma.reward.findMany.mockResolvedValue([]);

      const result = await service.getDashboardSummary();

      expect(result.retentionRate).toBe(0);
      expect(result.avgVisitsPerClient).toBe(0);
      expect(result.totalRedemptionCost).toBe(0);
      expect(result.pointsOutstanding).toBe(0);
      expect(result.stampsOutstanding).toBe(0);
      expect(result.redemptionRate).toBe(0);
      expect(result.lifetimeRevenue).toBe(0);
      expect(result.clientsBySegment).toEqual({ active: 0, at_risk: 0, dormant: 0, lost: 0, never: 0 });
    });
  });

  describe('listClients', () => {
    it('pagina, busca por nombre/whatsapp y etiqueta el segmento de recencia de cada cliente', async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: 'client-1', name: 'Ana', stamps: 3, points: 40, totalSpent: 150, lastVisitAt: null },
      ]);
      prisma.client.count.mockResolvedValue(1);

      const result = await service.listClients({ search: 'Ana', page: 2, limit: 10 });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({
        data: [{ id: 'client-1', name: 'Ana', stamps: 3, points: 40, totalSpent: 150, lastVisitAt: null, segment: 'never' }],
        total: 1,
        page: 2,
        limit: 10,
      });
    });

    it('filtra por segmento (p. ej. "at_risk" para saber a quién reactivar)', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await service.listClients({ segment: 'at_risk' });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ lastVisitAt: expect.objectContaining({ lt: expect.any(Date), gte: expect.any(Date) }) }),
        }),
      );
    });

    it('segmenta por día calendario exacto — sin ventanas de desacuerdo entre el badge y el filtro', () => {
      // Regresión: antes daysSince truncaba con floor() sobre una diferencia continua
      // mientras segmentWhere comparaba contra un instante continuo, así que un cliente
      // que visitó hace 30 días y unas horas se etiquetaba "activo" pero el filtro lo
      // devolvía en "en_riesgo". Se prueba exhaustivamente cada hora de 100 días.
      const now = new Date('2026-09-27T08:20:00.000Z');
      const DAY_MS = 24 * 60 * 60 * 1000;

      // Se valida directamente contra `segmentWhere`: por cada hora posible, el segmento
      // que le correspondería a un cliente por su recencia debe coincidir con que ese
      // mismo cliente efectivamente califique en el `where` que arma segmentWhere.
      const matches = (date: Date, cond: Record<string, unknown>): boolean => {
        const gte = cond.gte as Date | undefined;
        const lt = cond.lt as Date | undefined;
        if (gte && date < gte) return false;
        if (lt && date >= lt) return false;
        return true;
      };

      for (let hours = 0; hours <= 100 * 24; hours += 1) {
        const lastVisitAt = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const days = Math.round(
          (new Date(now).setHours(0, 0, 0, 0) - new Date(lastVisitAt).setHours(0, 0, 0, 0)) / DAY_MS,
        );
        const expectedSegment = days <= 30 ? 'active' : days <= 60 ? 'at_risk' : days <= 90 ? 'dormant' : 'lost';
        const cond = segmentWhere(expectedSegment, now) as { lastVisitAt: Record<string, unknown> };
        expect(matches(lastVisitAt, cond.lastVisitAt)).toBe(true);
      }
    });
  });

  describe('getClientInsights', () => {
    it('calcula costo vs. beneficio, potencial (próximo premio) y una recomendación según el segmento', async () => {
      prisma.client.findUniqueOrThrow.mockResolvedValue({
        stamps: 3,
        totalSpent: 500,
        lastVisitAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 días -> at_risk
        _count: { visits: 4, redemptions: 1 },
      });
      prisma.redemption.aggregate.mockResolvedValue({ _sum: { costAtRedemption: 150 } });
      prisma.reward.findMany.mockResolvedValue([
        { name: 'Combo personal gratis', stampsCost: 8 },
        { name: 'Entrada VIP', stampsCost: 12 },
      ]);

      const result = await service.getClientInsights('client-1');

      expect(result.totalSpent).toBe(500);
      expect(result.redemptionCost).toBe(150);
      expect(result.netValue).toBe(350); // cuánto ha generado neto, descontando lo canjeado
      expect(result.avgSpendPerVisit).toBe(125); // 500 / 4 visitas
      expect(result.segment).toBe('at_risk');
      expect(result.nextReward).toEqual({ name: 'Combo personal gratis', stampsCost: 8 });
      expect(result.stampsToNextReward).toBe(5); // le faltan 5 sellos (8 - 3)
      expect(result.recommendation).toMatch(/recordatorio|promoción/i);
    });
  });

  describe('getRewardsRoi', () => {
    it('desglosa el costo REAL por premio (no el precio actual × conteo) y compara el gasto de quienes canjean vs. quienes no', async () => {
      prisma.reward.findMany.mockResolvedValue([
        { id: 'reward-1', name: 'Entrada 2D gratis', isActive: true, stampsCost: 5, pointsCost: null, monetaryValue: 120 },
        { id: 'reward-2', name: 'Combo personal gratis', isActive: true, stampsCost: 8, pointsCost: null, monetaryValue: 80 },
      ]);
      // reward-1 costó 100 en sus primeros 3 canjes y el admin subió el precio a 120
      // ANTES del 4to canje — el costo total real (100*3 + 120*1 = 420) no es
      // simplemente monetaryValue actual (120) × 4 (=480). Por eso se usa el _sum real.
      prisma.redemption.groupBy.mockResolvedValue([
        { rewardId: 'reward-1', _count: 4, _sum: { costAtRedemption: 420 } },
        { rewardId: 'reward-2', _count: 1, _sum: { costAtRedemption: 80 } },
      ]);
      prisma.client.aggregate
        .mockResolvedValueOnce({ _sum: { totalSpent: 8000 } }) // ingresos totales de la base
        .mockResolvedValueOnce({ _avg: { totalSpent: 900 }, _count: 10 }) // canjean
        .mockResolvedValueOnce({ _avg: { totalSpent: 300 }, _count: 40 }); // no canjean

      const result = await service.getRewardsRoi();

      expect(result.rewards).toEqual([
        { rewardId: 'reward-1', name: 'Entrada 2D gratis', isActive: true, stampsCost: 5, pointsCost: null, currentUnitCost: 120, timesRedeemed: 4, totalCost: 420, costSharePercent: 84 },
        { rewardId: 'reward-2', name: 'Combo personal gratis', isActive: true, stampsCost: 8, pointsCost: null, currentUnitCost: 80, timesRedeemed: 1, totalCost: 80, costSharePercent: 16 },
      ]);
      expect(result.totalCost).toBe(500); // 420 + 80, NO 120*4 + 80*1 = 560
      expect(result.totalRevenue).toBe(8000);
      expect(result.costToRevenuePercent).toBe(6.3); // 500 / 8000
      expect(result.avgSpendRedeemers).toBe(900);
      expect(result.avgSpendNonRedeemers).toBe(300);
      // La señal clave: quienes canjean gastan L.600 más en promedio que quienes no.
      expect(result.spendLift).toBe(600);
    });

    it('reparte costSharePercent para que SIEMPRE sume 100%, incluso cuando el redondeo simple no cerraría', async () => {
      // 3 premios con exactamente 1/3 del costo cada uno: 33.33...% se redondearía a
      // 33% los tres y sumaría 99%, no 100%. El método del mayor resto le da el punto
      // extra al primero (todos empatan en el residuo) para cerrar en 100.
      prisma.reward.findMany.mockResolvedValue([
        { id: 'reward-1', name: 'Premio A', isActive: true, stampsCost: 5, pointsCost: null, monetaryValue: 100 },
        { id: 'reward-2', name: 'Premio B', isActive: true, stampsCost: 5, pointsCost: null, monetaryValue: 100 },
        { id: 'reward-3', name: 'Premio C', isActive: true, stampsCost: 5, pointsCost: null, monetaryValue: 100 },
      ]);
      prisma.redemption.groupBy.mockResolvedValue([
        { rewardId: 'reward-1', _count: 1, _sum: { costAtRedemption: 100 } },
        { rewardId: 'reward-2', _count: 1, _sum: { costAtRedemption: 100 } },
        { rewardId: 'reward-3', _count: 1, _sum: { costAtRedemption: 100 } },
      ]);
      prisma.client.aggregate
        .mockResolvedValueOnce({ _sum: { totalSpent: 0 } })
        .mockResolvedValueOnce({ _avg: { totalSpent: 0 }, _count: 0 })
        .mockResolvedValueOnce({ _avg: { totalSpent: 0 }, _count: 0 });

      const result = await service.getRewardsRoi();

      const shares = result.rewards.map((r) => r.costSharePercent);
      expect(shares.reduce((sum, p) => sum + p, 0)).toBe(100);
      expect(shares.sort()).toEqual([33, 33, 34]);
    });
  });

  describe('listRedemptions', () => {
    it('devuelve el listado paginado junto con el costo total real (L.) de los canjes filtrados', async () => {
      prisma.redemption.findMany.mockResolvedValue([{ id: 'redemption-1' }]);
      prisma.redemption.count.mockResolvedValue(1);
      prisma.redemption.aggregate.mockResolvedValue({ _sum: { costAtRedemption: 150 } });

      const result = await service.listRedemptions({ page: 1, limit: 20 });

      expect(result).toEqual({ data: [{ id: 'redemption-1' }], total: 1, page: 1, limit: 20, totalCost: 150 });
    });
  });

  describe('getTrends', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('reconstruye ingresos/costo/retención mes a mes desde filas reales con fecha', async () => {
      prisma.client.findMany.mockResolvedValue([
        { id: 'c1', createdAt: new Date('2026-01-10T00:00:00.000Z') },
        { id: 'c2', createdAt: new Date('2026-02-05T00:00:00.000Z') },
      ]);
      prisma.visit.findMany.mockResolvedValue([
        { clientId: 'c1', createdAt: new Date('2026-02-10T00:00:00.000Z'), amountSpent: 50 },
        { clientId: 'c1', createdAt: new Date('2026-03-05T00:00:00.000Z'), amountSpent: 30 },
        { clientId: 'c2', createdAt: new Date('2026-02-20T00:00:00.000Z'), amountSpent: 20 },
      ]);
      prisma.redemption.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-15T00:00:00.000Z'), costAtRedemption: 15 },
        { createdAt: new Date('2026-03-10T00:00:00.000Z'), costAtRedemption: 25 },
      ]);

      const { points } = await service.getTrends(2);

      expect(points.map((p) => p.month)).toEqual(['2026-02', '2026-03']);

      const [feb, mar] = points;
      expect(feb.newClients).toBe(1); // solo c2 se enroló en febrero
      expect(feb.visits).toBe(2); // v1 (c1) + v3 (c2)
      expect(feb.revenue).toBe(70); // 50 + 20
      expect(feb.redemptions).toBe(1);
      expect(feb.redemptionCost).toBe(15);
      expect(feb.costToRevenuePercent).toBe(21.4); // 15/70
      expect(feb.monthlyRetentionRate).toBeNull(); // no hay mes previo en la ventana
      expect(feb.clientsBySegment).toEqual({ active: 2, at_risk: 0, dormant: 0, lost: 0, never: 0 });

      expect(mar.newClients).toBe(0);
      expect(mar.visits).toBe(1); // solo v2 (c1) — "ahora" recorta el mes a mitad de marzo
      expect(mar.revenue).toBe(30);
      expect(mar.redemptions).toBe(1);
      expect(mar.redemptionCost).toBe(25);
      expect(mar.costToRevenuePercent).toBe(83.3); // 25/30
      // De los 2 clientes que vinieron en feb, solo c1 volvió en marzo -> 1/2 = 50%.
      expect(mar.monthlyRetentionRate).toBe(50);
      expect(mar.clientsBySegment).toEqual({ active: 2, at_risk: 0, dormant: 0, lost: 0, never: 0 });
    });
  });

  describe('getComplexComparison', () => {
    it('compara complejos por ingresos, retención y costo — no solo por tráfico', async () => {
      prisma.complex.findMany.mockResolvedValue([
        { id: 'complex-a', name: 'Complejo A', city: 'Tegucigalpa' },
        { id: 'complex-b', name: 'Complejo B', city: 'San Pedro Sula' },
      ]);
      // Complejo A: 2 visitas, 1 cliente que repite.
      prisma.visit.findMany.mockResolvedValueOnce([{ amountSpent: 100 }, { amountSpent: 50 }]);
      prisma.redemption.aggregate.mockResolvedValueOnce({ _sum: { costAtRedemption: 20 } });
      prisma.redemption.count.mockResolvedValueOnce(3);
      prisma.visit.groupBy.mockResolvedValueOnce([{ clientId: 'c1', _count: 2 }]);
      // Complejo B: 1 visita de mayor ticket, 2 clientes que no repiten, sin canjes.
      prisma.visit.findMany.mockResolvedValueOnce([{ amountSpent: 300 }]);
      prisma.redemption.aggregate.mockResolvedValueOnce({ _sum: { costAtRedemption: null } });
      prisma.redemption.count.mockResolvedValueOnce(0);
      prisma.visit.groupBy.mockResolvedValueOnce([
        { clientId: 'c2', _count: 1 },
        { clientId: 'c3', _count: 1 },
      ]);

      const result = await service.getComplexComparison();

      // Ordenado por ingresos: B (300) antes que A (150), aunque A tenga más visitas.
      expect(result).toEqual([
        {
          complexId: 'complex-b',
          name: 'Complejo B',
          city: 'San Pedro Sula',
          visits: 1,
          distinctClients: 2,
          revenue: 300,
          avgSpendPerVisit: 300,
          redemptions: 0,
          redemptionCost: 0,
          retentionRate: 0,
        },
        {
          complexId: 'complex-a',
          name: 'Complejo A',
          city: 'Tegucigalpa',
          visits: 2,
          distinctClients: 1,
          revenue: 150,
          avgSpendPerVisit: 75,
          redemptions: 3,
          redemptionCost: 20,
          retentionRate: 100,
        },
      ]);
    });
  });

  describe('getAlerts', () => {
    it('avisa cuando la base en riesgo/dormida/perdida crece >=20% (y al menos 2 clientes) mes a mes', async () => {
      jest.spyOn(service, 'getTrends').mockResolvedValue({
        points: [
          {
            month: '2026-01',
            newClients: 5,
            visits: 10,
            revenue: 100,
            redemptions: 1,
            redemptionCost: 10,
            costToRevenuePercent: 10,
            monthlyRetentionRate: null,
            clientsBySegment: { active: 8, at_risk: 2, dormant: 1, lost: 1, never: 0 },
          },
          {
            month: '2026-02',
            newClients: 5,
            visits: 10,
            revenue: 100,
            redemptions: 1,
            redemptionCost: 10,
            costToRevenuePercent: 10,
            monthlyRetentionRate: 80,
            clientsBySegment: { active: 5, at_risk: 3, dormant: 2, lost: 2, never: 0 },
          },
        ],
      });

      const result = await service.getAlerts();

      expect(result.alerts).toEqual(
        expect.arrayContaining([expect.objectContaining({ level: 'warning', title: expect.stringContaining('en riesgo') })]),
      );
    });

    it('no genera alertas cuando no hay al menos dos meses de historia para comparar', async () => {
      jest.spyOn(service, 'getTrends').mockResolvedValue({
        points: [
          {
            month: '2026-03',
            newClients: 1,
            visits: 1,
            revenue: 10,
            redemptions: 0,
            redemptionCost: 0,
            costToRevenuePercent: 0,
            monthlyRetentionRate: null,
            clientsBySegment: { active: 1, at_risk: 0, dormant: 0, lost: 0, never: 0 },
          },
        ],
      });

      const result = await service.getAlerts();

      expect(result.alerts).toEqual([]);
    });
  });
});
