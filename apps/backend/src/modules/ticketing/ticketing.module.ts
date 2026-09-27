import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { BoxOfficeService } from './box-office.service';
import { BoxOfficeController } from './box-office.controller';
import { ShowtimeLifecycleService } from './showtime-lifecycle.service';
import { TicketingCronController } from './ticketing-cron.controller';
import { TicketQrService } from './ticket-qr.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [CatalogController, BoxOfficeController, TicketingCronController],
  providers: [CatalogService, BoxOfficeService, ShowtimeLifecycleService, TicketQrService],
  exports: [BoxOfficeService, ShowtimeLifecycleService, TicketQrService],
})
export class TicketingModule {}
