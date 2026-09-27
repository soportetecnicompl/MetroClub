import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { BoxOfficeService } from './box-office.service';
import { ShowtimeLifecycleService } from './showtime-lifecycle.service';

@Controller('internal/cron')
export class TicketingCronController {
  constructor(
    private readonly boxOfficeService: BoxOfficeService,
    private readonly showtimeLifecycleService: ShowtimeLifecycleService,
  ) {}

  private assertAuthorized(authorization: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected || authorization !== `Bearer ${expected}`) {
      throw new ForbiddenException('CRON_SECRET inválido o ausente');
    }
  }

  /** Libera reservas de butacas vencidas — higiene periódica (la disponibilidad ya se
   * calcula correctamente sin este job: getSeatMap/holdSeat ignoran HELD vencidos). */
  @Get('release-expired-holds')
  async releaseExpiredHolds(@Headers('authorization') authorization: string | undefined) {
    this.assertAuthorized(authorization);
    return this.boxOfficeService.releaseExpiredHolds();
  }

  /** Evalúa el mínimo de ventas de cada función y cancela/confirma automáticamente. */
  @Get('evaluate-showtimes')
  async evaluateShowtimes(@Headers('authorization') authorization: string | undefined) {
    this.assertAuthorized(authorization);
    return this.showtimeLifecycleService.evaluateShowtimes();
  }
}
