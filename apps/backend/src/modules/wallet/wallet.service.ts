import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletPlatform } from '@prisma/client';
import { ApplePassService } from './apple/apple-pass.service';
import { ApplePushService } from './apple/apple-push.service';
import { GoogleWalletService } from './google/google-wallet.service';

/**
 * Orquesta la emisión y actualización de la tarjeta digital MetroClub en
 * Apple Wallet y Google Wallet (RF-03, RF-05).
 *
 * - Apple: el `.pkpass` se genera bajo demanda (al descargarlo o cuando el
 *   web service lo pide tras un push) — ver apple/apple-pass.service.ts.
 * - Google: el "objeto de lealtad" se crea/actualiza vía API en cuanto se
 *   emite o cambia la tarjeta — Google refleja el cambio en el pass ya
 *   guardado sin necesidad de un push aparte.
 *
 * Sin credenciales reales configuradas (ver docs/wallet-integration.md),
 * ambos servicios degradan de forma segura: registran una advertencia y no
 * hacen la llamada externa, para no romper el flujo de enrolamiento/sellado.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applePassService: ApplePassService,
    private readonly applePushService: ApplePushService,
    private readonly googleWalletService: GoogleWalletService,
  ) {}

  async issuePasses(clientId: string) {
    const existing = await this.prisma.walletPass.findMany({ where: { clientId } });
    if (existing.length > 0) {
      return existing;
    }

    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });

    const [applePass, googlePass] = await this.prisma.$transaction([
      this.prisma.walletPass.create({
        data: { clientId, platform: WalletPlatform.APPLE, serialNumber: `apple-${clientId}` },
      }),
      this.prisma.walletPass.create({
        data: { clientId, platform: WalletPlatform.GOOGLE, serialNumber: `google-${clientId}` },
      }),
    ]);

    const objectId = await this.googleWalletService.upsertLoyaltyObject(client);
    if (objectId) {
      const saveLink = this.googleWalletService.buildSaveLink(objectId);
      if (saveLink) {
        await this.prisma.walletPass.update({ where: { id: googlePass.id }, data: { passUrl: saveLink } });
      }
    }

    return [applePass, googlePass];
  }

  /** RF-05: refleja sellos/puntos nuevos en los passes ya emitidos del cliente. */
  async pushUpdate(clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    const passes = await this.prisma.walletPass.findMany({
      where: { clientId },
      include: { appleDeviceRegistrations: true },
    });

    await this.googleWalletService.upsertLoyaltyObject(client);

    const applePass = passes.find((p) => p.platform === WalletPlatform.APPLE);
    if (applePass) {
      const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
      if (passTypeIdentifier) {
        await Promise.all(
          applePass.appleDeviceRegistrations.map((registration) =>
            this.applePushService.notifyDevice(registration.pushToken, passTypeIdentifier),
          ),
        );
      }
    }

    this.logger.debug(`Wallet passes actualizados para el cliente ${clientId}`);
    await this.prisma.walletPass.updateMany({ where: { clientId }, data: { lastPushedAt: new Date() } });
  }

  /** Genera el .pkpass real bajo demanda (usado por la descarga y el web service de Apple). */
  async generateApplePassFile(clientId: string) {
    const applePass = await this.prisma.walletPass.findFirst({
      where: { clientId, platform: WalletPlatform.APPLE },
      include: { client: true },
    });
    if (!applePass) return null;

    return this.applePassService.generate({ client: applePass.client, walletPass: applePass });
  }
}
