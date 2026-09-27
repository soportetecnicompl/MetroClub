import { GoogleWalletService } from './google-wallet.service';

describe('GoogleWalletService', () => {
  const buildConfig = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`Falta la variable ${key}`);
      return value;
    }),
  });

  const client = { id: 'client-1', name: 'Ana', stamps: 3, points: 40 };
  let loyaltyService: { getStampProgress: jest.Mock };

  beforeEach(() => {
    loyaltyService = { getStampProgress: jest.fn() };
  });

  it('isConfigured() es false sin GOOGLE_WALLET_ISSUER_ID / _SERVICE_ACCOUNT_JSON', () => {
    const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);
    expect(service.isConfigured()).toBe(false);
  });

  it('isConfigured() es true con ambas variables presentes', () => {
    const service = new GoogleWalletService(
      buildConfig({ GOOGLE_WALLET_ISSUER_ID: '3388000000022', GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: '{}' }) as never,
      loyaltyService as never,
    );
    expect(service.isConfigured()).toBe(true);
  });

  it('upsertLoyaltyObject() no falla y devuelve null si Google Wallet no está configurado', async () => {
    const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);

    const result = await service.upsertLoyaltyObject(client);

    expect(result).toBeNull();
  });

  it('buildSaveLink() devuelve null si Google Wallet no está configurado', () => {
    const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);

    expect(service.buildSaveLink('object-1')).toBeNull();
  });

  describe('buildStampProgress (sellos pendientes)', () => {
    type ProgressFn = (
      s: number,
    ) => Promise<{ shortLabel: string; detailText: string; total: number | null; rewardName: string | null }>;

    it('muestra sellos llenos/vacíos y "N/total" hacia el próximo premio', async () => {
      loyaltyService.getStampProgress.mockResolvedValue({
        rewards: [],
        nextReward: { name: 'Entrada 2D gratis', stampsCost: 5 },
      });
      const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);

      const progress = await (service as unknown as { buildStampProgress: ProgressFn }).buildStampProgress(3);

      expect(progress.shortLabel).toBe('Sellos (3/5 → Entrada 2D gratis)');
      expect(progress.detailText).toBe('●●●○○  3/5 → Entrada 2D gratis');
    });

    it('felicita al cliente cuando ya no hay un próximo premio (todos desbloqueados)', async () => {
      loyaltyService.getStampProgress.mockResolvedValue({ rewards: [], nextReward: null });
      const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);

      const progress = await (service as unknown as { buildStampProgress: ProgressFn }).buildStampProgress(12);

      expect(progress.detailText).toContain('premios listos para canjear');
    });
  });

  describe('memberCode', () => {
    it('genera un código corto y legible a partir del id del cliente', () => {
      const service = new GoogleWalletService(buildConfig({}) as never, loyaltyService as never);

      const code = (service as unknown as { memberCode: (id: string) => string }).memberCode('cmuhojotn0000iekdhgaqbjal');

      expect(code).toBe('MC-AQBJAL');
    });
  });
});
