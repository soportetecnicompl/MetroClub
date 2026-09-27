import { Module } from '@nestjs/common';
import { TicketingModule } from '../ticketing/ticketing.module';
import { ConcessionsModule } from '../concessions/concessions.module';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';

@Module({
  imports: [TicketingModule, ConcessionsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
