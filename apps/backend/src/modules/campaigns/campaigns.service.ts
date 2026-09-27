import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignStatus, Prisma, WhatsAppMessageType } from '@prisma/client';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { SendSegmentCampaignDto } from './dto/send-segment-campaign.dto';
import { SendClientCampaignDto } from './dto/send-client-campaign.dto';
import { segmentWhere } from '../reports/reports.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

/** RF-14: campañas de estrenos/eventos, envío masivo o segmentado. */
@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        segment: dto.segment as Prisma.InputJsonValue,
        status: dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
      },
    });
  }

  /**
   * El "call to action" de los KPIs de segmentación (dashboard y /clients): en vez de
   * solo mostrar "8 clientes en riesgo", encola de una vez la plantilla de WhatsApp
   * elegida para todos los clientes de ese segmento. n8n/Chatwoot son quienes realmente
   * despachan el mensaje (ver whatsapp.service.ts); aquí solo se encola.
   */
  async sendToSegment(dto: SendSegmentCampaignDto) {
    const now = new Date();
    const clients = await this.prisma.client.findMany({
      where: { isDeleted: false, ...segmentWhere(dto.segment, now) },
      select: { id: true },
    });

    let queued = 0;
    for (const client of clients) {
      const message = await this.whatsappService.queueMessage(client.id, WhatsAppMessageType.CAMPAIGN, dto.templateName);
      if (message) queued += 1;
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name ?? `Segmento "${dto.segment}" — plantilla "${dto.templateName}"`,
        status: CampaignStatus.SENT,
        sentAt: now,
        segment: { type: 'recency', value: dto.segment, templateName: dto.templateName } as Prisma.InputJsonValue,
      },
    });

    return { campaign, matched: clients.length, queued };
  }

  /** El CTA de la pantalla de detalle de un cliente: una sola plantilla, un solo destinatario. */
  async sendToClient(dto: SendClientCampaignDto) {
    const message = await this.whatsappService.queueMessage(dto.clientId, WhatsAppMessageType.CAMPAIGN, dto.templateName);
    return { queued: message !== null };
  }
}
