import { Module } from '@nestjs/common';
import { TicketingModule } from '../ticketing/ticketing.module';
import { ConcessionsService } from './concessions.service';
import { ConcessionsController } from './concessions.controller';

@Module({
  imports: [TicketingModule],
  controllers: [ConcessionsController],
  providers: [ConcessionsService],
  exports: [ConcessionsService],
})
export class ConcessionsModule {}
