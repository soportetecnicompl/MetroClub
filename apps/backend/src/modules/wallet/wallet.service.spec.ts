import { WalletService } from './wallet.service';
import { WalletPlatform } from '@prisma/client';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: {
    walletPass: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    client: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let applePassService: { generate: jest.Mock };
  let applePushService: { notifyDevice: jest.Mock };
  let googleWalletService: { upsertLoyaltyObject: jest.Mock; buildSaveLink: jest.Mock };

  const client = { id: 'client-1', name: 'Ana', stamps: 3, points: 40 };

  beforeEach(() => {
    prisma = {
      walletPass: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      client: { findUniqueOrThrow: jest.fn().mockResolvedValue(client) },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    applePassService = { generate: jest.fn() };
    applePushService = { notifyDevice: jest.fn() };
    googleWalletService = { upsertLoyaltyObject: jest.fn().mockResolvedValue(null), buildSaveLink: jest.fn() };

    service = new WalletService(
      prisma as never,
      applePassService as never,
      applePushService as never,
      googleWalletService as never,
    );
  });

  describe('issuePasses', () => {
    it('emite un pass de Apple y uno de Google para un cliente nuevo (RF-03)', async () => {
      prisma.walletPass.findMany.mockResolvedValue([]);
      prisma.walletPass.create
        .mockResolvedValueOnce({ id: 'pass-apple', platform: WalletPlatform.APPLE })
        .mockResolvedValueOnce({ id: 'pass-google', platform: WalletPlatform.GOOGLE });

      const result = await service.issuePasses('client-1');

      expect(prisma.walletPass.create).toHaveBeenCalledTimes(2);
      expect(prisma.walletPass.create).toHaveBeenCalledWith({
        data: { clientId: 'client-1', platform: WalletPlatform.APPLE, serialNumber: 'apple-client-1' },
      });
      expect(prisma.walletPass.create).toHaveBeenCalledWith({
        data: { clientId: 'client-1', platform: WalletPlatform.GOOGLE, serialNumber: 'google-client-1' },
      });
      expect(googleWalletService.upsertLoyaltyObject).toHaveBeenCalledWith(client);
      expect(result).toEqual([
        { id: 'pass-apple', platform: WalletPlatform.APPLE },
        { id: 'pass-google', platform: WalletPlatform.GOOGLE },
      ]);
    });

    it('guarda el link de "Guardar en Google Wallet" cuando Google está configurado', async () => {
      prisma.walletPass.findMany.mockResolvedValue([]);
      prisma.walletPass.create
        .mockResolvedValueOnce({ id: 'pass-apple', platform: WalletPlatform.APPLE })
        .mockResolvedValueOnce({ id: 'pass-google', platform: WalletPlatform.GOOGLE });
      googleWalletService.upsertLoyaltyObject.mockResolvedValue('object-1');
      googleWalletService.buildSaveLink.mockReturnValue('https://pay.google.com/gp/v/save/xyz');

      await service.issuePasses('client-1');

      expect(prisma.walletPass.update).toHaveBeenCalledWith({
        where: { id: 'pass-google' },
        data: { passUrl: 'https://pay.google.com/gp/v/save/xyz' },
      });
    });

    it('no duplica los passes si el cliente ya los tiene', async () => {
      const existing = [{ id: 'pass-apple' }, { id: 'pass-google' }];
      prisma.walletPass.findMany.mockResolvedValue(existing);

      const result = await service.issuePasses('client-1');

      expect(prisma.walletPass.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });
  });

  describe('pushUpdate', () => {
    it('actualiza el loyaltyObject de Google y envía push a los dispositivos Apple registrados (RF-05)', async () => {
      process.env.APPLE_PASS_TYPE_IDENTIFIER = 'pass.hn.metrocinemas.metroclub';
      prisma.walletPass.findMany.mockResolvedValue([
        {
          platform: WalletPlatform.APPLE,
          appleDeviceRegistrations: [{ pushToken: 'token-1' }, { pushToken: 'token-2' }],
        },
        { platform: WalletPlatform.GOOGLE, appleDeviceRegistrations: [] },
      ]);
      prisma.walletPass.updateMany.mockResolvedValue({ count: 2 });

      await service.pushUpdate('client-1');

      expect(googleWalletService.upsertLoyaltyObject).toHaveBeenCalledWith(client);
      expect(applePushService.notifyDevice).toHaveBeenCalledWith('token-1', 'pass.hn.metrocinemas.metroclub');
      expect(applePushService.notifyDevice).toHaveBeenCalledWith('token-2', 'pass.hn.metrocinemas.metroclub');
      expect(prisma.walletPass.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        data: { lastPushedAt: expect.any(Date) },
      });

      delete process.env.APPLE_PASS_TYPE_IDENTIFIER;
    });
  });

  describe('generateApplePassFile', () => {
    it('delega en ApplePassService con el cliente y el pass de Apple del cliente', async () => {
      const applePass = { id: 'pass-apple', client, platform: WalletPlatform.APPLE };
      prisma.walletPass.findFirst.mockResolvedValue(applePass);
      applePassService.generate.mockResolvedValue(Buffer.from('pkpass'));

      const result = await service.generateApplePassFile('client-1');

      expect(applePassService.generate).toHaveBeenCalledWith({ client, walletPass: applePass });
      expect(result).toEqual(Buffer.from('pkpass'));
    });

    it('devuelve null si el cliente no tiene un pass de Apple emitido', async () => {
      prisma.walletPass.findFirst.mockResolvedValue(null);

      const result = await service.generateApplePassFile('client-1');

      expect(result).toBeNull();
      expect(applePassService.generate).not.toHaveBeenCalled();
    });
  });
});
