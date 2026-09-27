import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClientsService } from '../clients/clients.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { WalletService } from '../wallet/wallet.service';
import { HeroImageService } from '../wallet/google/hero-image.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletPlatform } from '@prisma/client';

/**
 * Endpoints públicos (sin JWT) para la experiencia del cliente: la tarjeta digital
 * "MetroClub" a la que apunta el deep link enviado por WhatsApp tras enrolarse (RF-03).
 *
 * NOTA DE SEGURIDAD: el MVP identifica la tarjeta por el id del cliente. Antes de
 * producción esto debe reemplazarse por un token opaco/firmado (no el id secuencial
 * de la base de datos) para evitar que alguien enumere tarjetas ajenas.
 */
@Controller('public/clients')
export class PublicController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly walletService: WalletService,
    private readonly heroImageService: HeroImageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/card')
  async getCard(@Param('id') id: string) {
    const client = await this.clientsService.findById(id);
    const progress = await this.loyaltyService.getStampProgress(client.stamps);
    const googlePass = await this.prisma.walletPass.findFirst({
      where: { clientId: id, platform: WalletPlatform.GOOGLE },
    });

    return {
      name: client.name,
      whatsappLast4: client.whatsapp.slice(-4),
      stamps: client.stamps,
      points: client.points,
      lastVisitAt: client.lastVisitAt,
      rewards: progress.rewards,
      nextReward: progress.nextReward,
      googleWalletSaveUrl: googlePass?.passUrl ?? null,
    };
  }

  /**
   * Imagen dinámica (heroImage) con la barra de progreso de sellos que se ve en la
   * vista principal del pase de Google Wallet — la Wallet API no soporta gráficos
   * personalizados por texto, así que este PNG generado en el momento es el único
   * punto de extensión posible (ver HeroImageService).
   */
  @Get(':id/wallet-hero.png')
  async getWalletHero(@Param('id') id: string, @Res() res: Response) {
    const client = await this.clientsService.findById(id);
    const progress = await this.loyaltyService.getStampProgress(client.stamps);

    const buffer = this.heroImageService.render({
      stamps: client.stamps,
      totalStamps: progress.nextReward?.stampsCost ?? null,
      rewardName: progress.nextReward?.name ?? null,
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  }

  /** Descarga el .pkpass real para "Agregar a Apple Wallet" (RF-03). */
  @Get(':id/apple-pass')
  async getApplePass(@Param('id') id: string, @Res() res: Response) {
    await this.clientsService.findById(id);
    const buffer = await this.walletService.generateApplePassFile(id);
    if (!buffer) {
      throw new NotFoundException(
        'Apple Wallet no está configurado todavía (ver docs/wallet-integration.md) o el cliente no tiene un pass emitido.',
      );
    }

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="metroclub.pkpass"');
    res.send(buffer);
  }
}
