import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicController } from './public.controller';
import { ClientsModule } from '../clients/clients.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    ClientsModule,
    LoyaltyModule,
    WalletModule,
    // Límite defensivo para el auto-enrolamiento público: sin login de por medio,
    // este endpoint queda expuesto a spam/abuso si no se acota por IP.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 5 }] }),
  ],
  controllers: [PublicController],
})
export class PublicModule {}
