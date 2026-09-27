import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { WalletService } from '../wallet/wallet.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EnrollClientDto } from './dto/enroll-client.dto';
import { RegisterVisitDto } from './dto/register-visit.dto';
import { UpdateClientDto } from './dto/update-client.dto';

/** Enrolamiento y sellado (RF-01 a RF-05, RF-20) y baja de clientes (NFR-07). */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
    private readonly walletService: WalletService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /** Busca por WhatsApp (identificador natural vía NFC/QR) para no repetir el enrolamiento. */
  findByWhatsapp(whatsapp: string) {
    return this.prisma.client.findUnique({ where: { whatsapp, isDeleted: false } });
  }

  /** Consulta pública de la tarjeta digital (usada por la pantalla del cliente). */
  async findById(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id, isDeleted: false } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return client;
  }

  /** RF-02/RF-03: primer contacto NFC → captura de datos + emisión de wallet passes. */
  async enroll(dto: EnrollClientDto) {
    const existing = await this.findByWhatsapp(dto.whatsapp);
    if (existing) {
      return existing;
    }

    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        whatsapp: dto.whatsapp,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      },
    });

    await this.walletService.issuePasses(client.id);
    return client;
  }

  /** RF-04/RF-05: visitas siguientes solo suman sello/puntos y refrescan el wallet pass. */
  async registerVisit(clientId: string, dto: RegisterVisitDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.isDeleted) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const { stampsEarned, pointsEarned } = await this.loyaltyService.calculateEarnings(dto.amountSpent ?? 0);

    const [, updatedClient] = await this.prisma.$transaction([
      this.prisma.visit.create({
        data: {
          clientId,
          complexId: dto.complexId,
          stampsEarned,
          pointsEarned,
          amountSpent: dto.amountSpent,
          channel: dto.channel ?? 'NFC',
        },
      }),
      this.prisma.client.update({
        where: { id: clientId },
        data: {
          stamps: { increment: stampsEarned },
          points: { increment: pointsEarned },
          lastVisitAt: new Date(),
        },
      }),
    ]);

    await this.walletService.pushUpdate(clientId);
    await this.whatsappService.schedulePostVisitMessage(clientId);

    return updatedClient;
  }

  /** Edita datos del cliente (p. ej. nombre) y refresca el wallet pass ya emitido. */
  async update(clientId: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.isDeleted) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
      },
    });

    await this.walletService.pushUpdate(clientId);

    return updatedClient;
  }

  /** RF-20: historial de actividad por cliente. */
  async getHistory(clientId: string) {
    const [visits, redemptions, whatsappMessages] = await Promise.all([
      this.prisma.visit.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.redemption.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.whatsAppMessage.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { visits, redemptions, whatsappMessages };
  }

  /** NFR-07: derecho al olvido — baja lógica + registro de auditoría. */
  async forget(clientId: string, actorId?: string) {
    await this.prisma.$transaction([
      this.prisma.client.update({ where: { id: clientId }, data: { isDeleted: true } }),
      this.prisma.auditLog.create({
        data: { clientId, actorId, action: 'CLIENT_FORGOTTEN' },
      }),
    ]);
  }
}
