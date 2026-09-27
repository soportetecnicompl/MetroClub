import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { BoxOfficeService } from './box-office.service';
import { BoxOfficeController } from './box-office.controller';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { ShowtimeLifecycleService } from './showtime-lifecycle.service';
import { TicketingCronController } from './ticketing-cron.controller';
import { TicketQrService } from './ticket-qr.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [CatalogController, BoxOfficeController, PromotionsController, TicketingCronController],
  providers: [CatalogService, BoxOfficeService, PromotionsService, ShowtimeLifecycleService, TicketQrService],
  exports: [BoxOfficeService, PromotionsService, ShowtimeLifecycleService, TicketQrService],
})
export class TicketingModule {}
