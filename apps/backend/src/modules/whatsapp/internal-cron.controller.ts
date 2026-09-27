import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

/**
 * Disparadores HTTP para los jobs que antes corrían como @Cron en memoria.
 * En Vercel (serverless) no hay proceso persistente, así que Vercel Cron
 * (ver vercel.json) llama a estos endpoints en el horario configurado
 * mediante un GET (así es como Vercel Cron invoca siempre, sin importar
 * el método declarado).
 *
 * Vercel agrega automáticamente `Authorization: Bearer <CRON_SECRET>` a
 * estas llamadas cuando existe una variable de entorno `CRON_SECRET` en el
 * proyecto — por eso validamos contra ese mismo header en vez de JWT.
 */
@Controller('internal/cron')
export class InternalCronController {
  constructor(private readonly whatsappService: WhatsappService) {}

  private assertAuthorized(authorization: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected || authorization !== `Bearer ${expected}`) {
      throw new ForbiddenException('CRON_SECRET inválido o ausente');
    }
  }

  @Get('birthday-greetings')
  async birthdayGreetings(@Headers('authorization') authorization: string | undefined) {
    this.assertAuthorized(authorization);
    await this.whatsappService.sendBirthdayGreetings();
    return { ok: true };
  }

  @Get('win-back-campaigns')
  async winBackCampaigns(@Headers('authorization') authorization: string | undefined) {
    this.assertAuthorized(authorization);
    await this.whatsappService.sendWinBackCampaigns();
    return { ok: true };
  }
}
