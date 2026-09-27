import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { BoxOfficeService } from './box-office.service';

/**
 * Job programado (Vercel Cron) que libera reservas de butacas vencidas. La disponibilidad
 * ya se calcula correctamente sin este job (getSeatMap/holdSeat ignoran HELD vencidos),
 * así que esto es higiene periódica, no una dependencia de corrección.
 */
@Controller('internal/cron')
export class TicketingCronController {
  constructor(private readonly boxOfficeService: BoxOfficeService) {}

  @Get('release-expired-holds')
  async releaseExpiredHolds(@Headers('authorization') authorization: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected || authorization !== `Bearer ${expected}`) {
      throw new ForbiddenException('CRON_SECRET inválido o ausente');
    }
    return this.boxOfficeService.releaseExpiredHolds();
  }
}
