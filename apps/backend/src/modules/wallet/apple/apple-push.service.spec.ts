import { ApplePushService } from './apple-push.service';

describe('ApplePushService', () => {
  const buildConfig = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`Falta la variable ${key}`);
      return value;
    }),
  });

  it('isConfigured() es false sin las credenciales de APNs', () => {
    const service = new ApplePushService(buildConfig({}) as never);
    expect(service.isConfigured()).toBe(false);
  });

  it('notifyDevice() no falla si APNs no está configurado (degradación segura)', async () => {
    const service = new ApplePushService(buildConfig({}) as never);

    await expect(service.notifyDevice('device-token', 'pass.hn.metrocinemas.metroclub')).resolves.toBeUndefined();
  });
});
