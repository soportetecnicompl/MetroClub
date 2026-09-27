import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApplePassService } from './apple-pass.service';

/**
 * Apple Wallet Web Service — implementa el contrato que Apple exige para que
 * un `.pkpass` reciba updates automáticos (registro de dispositivo + push).
 * https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
 *
 * No usa JWT: cada request trae `Authorization: ApplePass <authToken>`, que
 * se compara contra el `authToken` guardado en el WalletPass (ver
 * apple-pass.service.ts). El GET de serial numbers no requiere auth (así lo
 * define la spec, va por dispositivo, no por pass individual).
 */
@Controller('wallet/apple/v1')
export class AppleWebServiceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applePassService: ApplePassService,
  ) {}

  private assertAuthorized(authHeader: string | undefined, expectedToken: string) {
    const token = authHeader?.replace(/^ApplePass\s+/i, '');
    if (!token || token !== expectedToken) {
      throw new UnauthorizedException();
    }
  }

  /** Un dispositivo se registra para recibir updates de un pass. */
  @Post('devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber')
  async registerDevice(
    @Param('deviceLibraryIdentifier') deviceLibraryIdentifier: string,
    @Param('serialNumber') serialNumber: string,
    @Body('pushToken') pushToken: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const walletPass = await this.prisma.walletPass.findUnique({ where: { serialNumber } });
    if (!walletPass) throw new NotFoundException();
    this.assertAuthorized(authorization, walletPass.authToken);

    await this.prisma.appleDeviceRegistration.upsert({
      where: { walletPassId_deviceLibraryIdentifier: { walletPassId: walletPass.id, deviceLibraryIdentifier } },
      update: { pushToken },
      create: { walletPassId: walletPass.id, deviceLibraryIdentifier, pushToken },
    });

    res.status(201).send();
  }

  /** El usuario quitó el pass de Wallet: dejamos de mandarle push. */
  @Delete('devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber')
  async unregisterDevice(
    @Param('deviceLibraryIdentifier') deviceLibraryIdentifier: string,
    @Param('serialNumber') serialNumber: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const walletPass = await this.prisma.walletPass.findUnique({ where: { serialNumber } });
    if (!walletPass) throw new NotFoundException();
    this.assertAuthorized(authorization, walletPass.authToken);

    await this.prisma.appleDeviceRegistration
      .delete({
        where: { walletPassId_deviceLibraryIdentifier: { walletPassId: walletPass.id, deviceLibraryIdentifier } },
      })
      .catch(() => undefined);

    res.status(200).send();
  }

  /** Apple pregunta qué passes de este dispositivo cambiaron desde `passesUpdatedSince`. */
  @Get('devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier')
  async getUpdatedSerialNumbers(@Param('deviceLibraryIdentifier') deviceLibraryIdentifier: string) {
    const registrations = await this.prisma.appleDeviceRegistration.findMany({
      where: { deviceLibraryIdentifier },
      include: { walletPass: true },
    });

    if (registrations.length === 0) {
      throw new NotFoundException();
    }

    return {
      lastUpdated: new Date().toISOString(),
      serialNumbers: registrations.map((r) => r.walletPass.serialNumber),
    };
  }

  /** Descarga el .pkpass actualizado. */
  @Get('passes/:passTypeIdentifier/:serialNumber')
  async getUpdatedPass(
    @Param('serialNumber') serialNumber: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const walletPass = await this.prisma.walletPass.findUnique({
      where: { serialNumber },
      include: { client: true },
    });
    if (!walletPass) throw new NotFoundException();
    this.assertAuthorized(authorization, walletPass.authToken);

    const buffer = await this.applePassService.generate({ client: walletPass.client, walletPass });
    if (!buffer) throw new NotFoundException();

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', walletPass.updatedAt.toUTCString());
    res.send(buffer);
  }

  /** Apple manda logs de error del web service aquí; solo los registramos. */
  @Post('log')
  log(@Body('logs') logs: string[]) {
    // eslint-disable-next-line no-console
    console.warn('[AppleWallet]', logs);
  }
}
