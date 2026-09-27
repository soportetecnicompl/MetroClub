import { PromotionsService } from './promotions.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: { promotion: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { promotion: { findMany: jest.fn() } };
    service = new PromotionsService(prisma as never);
  });

  const context = { isMetroClub: true, movieId: 'movie-1', format: 'D2', complexId: 'complex-1' };

  it('devuelve null cuando ninguna promoción activa aplica al contexto', async () => {
    prisma.promotion.findMany.mockResolvedValue([]);

    const result = await service.getApplicablePromotion(context, 100);

    expect(result).toBeNull();
  });

  it('filtra promociones que requieren MetroClub cuando el cliente no está identificado', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      { id: 'p1', type: 'PERCENT_OFF', value: 10, scope: 'ALL_TICKETS', requiresMetroClub: true, endsAt: null },
    ]);

    const result = await service.getApplicablePromotion({ ...context, isMetroClub: false }, 100);

    expect(result).toBeNull();
  });

  it('descarta promociones cuya scope no coincide (película/formato/complejo distintos)', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      { id: 'p1', type: 'PERCENT_OFF', value: 10, scope: 'MOVIE', movieId: 'otra-pelicula', requiresMetroClub: false, endsAt: null },
      { id: 'p2', type: 'PERCENT_OFF', value: 10, scope: 'FORMAT', format: 'VIP', requiresMetroClub: false, endsAt: null },
      { id: 'p3', type: 'PERCENT_OFF', value: 10, scope: 'COMPLEX', complexId: 'otro-complejo', requiresMetroClub: false, endsAt: null },
    ]);

    const result = await service.getApplicablePromotion(context, 100);

    expect(result).toBeNull();
  });

  it('descarta promociones ya vencidas (endsAt en el pasado)', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      {
        id: 'p1',
        type: 'PERCENT_OFF',
        value: 50,
        scope: 'ALL_TICKETS',
        requiresMetroClub: false,
        endsAt: new Date(Date.now() - 3_600_000),
      },
    ]);

    const result = await service.getApplicablePromotion(context, 100);

    expect(result).toBeNull();
  });

  it('elige la promoción que da el mayor descuento cuando varias aplican (sin acumular)', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      { id: 'small', type: 'PERCENT_OFF', value: 10, scope: 'ALL_TICKETS', requiresMetroClub: true, endsAt: null },
      { id: 'big', type: 'FIXED_AMOUNT_OFF', value: 25, scope: 'MOVIE', movieId: 'movie-1', requiresMetroClub: true, endsAt: null },
    ]);

    const result = await service.getApplicablePromotion(context, 100);

    expect(result?.promotion.id).toBe('big');
    expect(result?.discountApplied).toBe(25);
  });

  it('nunca otorga un descuento mayor al precio base', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      { id: 'p1', type: 'FIXED_AMOUNT_OFF', value: 500, scope: 'ALL_TICKETS', requiresMetroClub: true, endsAt: null },
    ]);

    const result = await service.getApplicablePromotion(context, 100);

    expect(result?.discountApplied).toBe(100);
  });

  describe('getApplicableConcessionDiscount', () => {
    const concessionContext = { isMetroClub: true, complexId: 'complex-1' };

    it('aplica el 10% MetroClub de confitería (scope ALL_CONCESSIONS)', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        { id: 'confi-10', type: 'PERCENT_OFF', value: 10, scope: 'ALL_CONCESSIONS', requiresMetroClub: true, endsAt: null },
      ]);

      const result = await service.getApplicableConcessionDiscount(concessionContext, 160);

      expect(result?.promotion.id).toBe('confi-10');
      expect(result?.discountApplied).toBe(16);
    });

    it('nunca deja que una promoción de boletos (ALL_TICKETS/MOVIE/FORMAT/COMPLEX) aplique a confitería', async () => {
      prisma.promotion.findMany.mockResolvedValue([]); // el query real filtra scope='ALL_CONCESSIONS' en BD

      const result = await service.getApplicableConcessionDiscount(concessionContext, 160);

      expect(result).toBeNull();
      expect(prisma.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ scope: 'ALL_CONCESSIONS' }) }),
      );
    });

    it('no aplica el descuento si el cliente no está identificado y la promoción requiere MetroClub', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        { id: 'confi-10', type: 'PERCENT_OFF', value: 10, scope: 'ALL_CONCESSIONS', requiresMetroClub: true, endsAt: null },
      ]);

      const result = await service.getApplicableConcessionDiscount({ ...concessionContext, isMetroClub: false }, 160);

      expect(result).toBeNull();
    });
  });
});
