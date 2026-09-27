import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppMessageType } from '@prisma/client';

const WIN_BACK_THRESHOLDS_DAYS = [30, 45, 60];

/**
 * Envío de plantillas aprobadas de WhatsApp Business API (Meta Cloud API / BSP).
 * Cubre RF-11 (post-visita), RF-12 (win-back), RF-13 (cumpleaños) y RF-14 (campañas).
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  async queueMessage(clientId: string, type: WhatsAppMessageType, templateName: string) {
    const template = await this.prisma.whatsAppTemplate.findUnique({ where: { name: templateName } });
    if (!template || !template.isActive) {
      this.logger.warn(`Plantilla "${templateName}" no encontrada o inactiva`);
      return null;
    }

    return this.prisma.whatsAppMessage.create({
      data: { clientId, templateId: template.id, type, status: 'queued' },
    });
  }

  /** RF-11: mensaje post-visita, 2-4 horas después de registrada la visita. */
  async schedulePostVisitMessage(clientId: string) {
    return this.queueMessage(clientId, WhatsAppMessageType.POST_VISIT, 'post_visit_feedback');
  }

  /**
   * RF-13: saluda por cumpleaños 7 días antes. Se ejecuta vía Vercel Cron
   * (ver vercel.json) contra InternalCronController — no hay proceso persistente
   * en serverless para un @Cron en memoria.
   */
  async sendBirthdayGreetings() {
    // TODO: consultar clientes con birthDate a 7 días y encolar plantilla 'birthday_greeting'.
    this.logger.debug('Job de cumpleaños ejecutado');
  }

  /**
   * RF-12: detecta clientes inactivos en los umbrales de win-back. Se ejecuta
   * vía Vercel Cron (ver vercel.json) contra InternalCronController — una vez al
   * día, por eso se busca "exactamente" ese umbral (no >=) para no reencolar el
   * mismo mensaje al mismo cliente en corridas futuras.
   */
  async sendWinBackCampaigns() {
    for (const days of WIN_BACK_THRESHOLDS_DAYS) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - days);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const clients = await this.prisma.client.findMany({
        where: { isDeleted: false, lastVisitAt: { gte: dayStart, lt: dayEnd } },
        select: { id: true },
      });

      for (const client of clients) {
        await this.queueMessage(client.id, WhatsAppMessageType.WIN_BACK, 'win_back');
      }

      this.logger.debug(`Job de win-back (${days} días): ${clients.length} cliente(s) encolado(s)`);
    }
  }
}
