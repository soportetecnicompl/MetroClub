import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { ClientsModule } from '../clients/clients.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ClientsModule, LoyaltyModule, WalletModule],
  controllers: [PublicController],
})
export class PublicModule {}
