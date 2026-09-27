import { Module } from '@nestjs/common';
import { TicketingModule } from '../ticketing/ticketing.module';
import { CorporateService } from './corporate.service';
import { CorporateController } from './corporate.controller';
import { VoucherQrService } from './voucher-qr.service';

@Module({
  imports: [TicketingModule],
  controllers: [CorporateController],
  providers: [CorporateService, VoucherQrService],
  exports: [CorporateService],
})
export class CorporateModule {}
