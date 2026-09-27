import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { InternalCronController } from './internal-cron.controller';

@Module({
  controllers: [WhatsappController, InternalCronController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
