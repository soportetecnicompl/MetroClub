import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { BoxOfficeService } from './box-office.service';
import { BoxOfficeController } from './box-office.controller';
import { TicketingCronController } from './ticketing-cron.controller';
import { TicketQrService } from './ticket-qr.service';

@Module({
  controllers: [CatalogController, BoxOfficeController, TicketingCronController],
  providers: [CatalogService, BoxOfficeService, TicketQrService],
  exports: [BoxOfficeService, TicketQrService],
})
export class TicketingModule {}
