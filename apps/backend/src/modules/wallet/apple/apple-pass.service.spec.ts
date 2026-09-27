import { ApplePassService } from './apple-pass.service';

describe('ApplePassService', () => {
  const buildConfig = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`Falta la variable ${key}`);
      return value;
    }),
  });

  it('isConfigured() es false si falta cualquier variable requerida', () => {
    const service = new ApplePassService(
      buildConfig({ APPLE_PASS_TYPE_IDENTIFIER: 'pass.hn.metrocinemas.metroclub' }) as never,
    );

    expect(service.isConfigured()).toBe(false);
  });

  it('isConfigured() es true cuando están todas las variables', () => {
    const service = new ApplePassService(
      buildConfig({
        APPLE_PASS_TYPE_IDENTIFIER: 'pass.hn.metrocinemas.metroclub',
        APPLE_TEAM_IDENTIFIER: 'TEAM123',
        APPLE_PASS_CERT_PATH: '/certs/cert.pem',
        APPLE_PASS_KEY_PATH: '/certs/key.pem',
        APPLE_PASS_CERT_PASSWORD: 'secret',
        APPLE_WWDR_CERT_PATH: '/certs/wwdr.pem',
      }) as never,
    );

    expect(service.isConfigured()).toBe(true);
  });

  it('generate() no falla y devuelve null si Apple Wallet no está configurado (degradación segura)', async () => {
    const service = new ApplePassService(buildConfig({}) as never);

    const result = await service.generate({
      client: { id: 'client-1', name: 'Ana', stamps: 3, points: 40 },
      walletPass: { serialNumber: 'apple-client-1', authToken: 'token' },
    });

    expect(result).toBeNull();
  });
});
