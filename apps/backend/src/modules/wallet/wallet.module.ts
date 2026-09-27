import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { ApplePassService } from './apple/apple-pass.service';
import { ApplePushService } from './apple/apple-push.service';
import { AppleWebServiceController } from './apple/apple-web-service.controller';
import { GoogleWalletService } from './google/google-wallet.service';
import { HeroImageService } from './google/hero-image.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [LoyaltyModule],
  controllers: [WalletController, AppleWebServiceController],
  providers: [WalletService, ApplePassService, ApplePushService, GoogleWalletService, HeroImageService],
  exports: [WalletService, HeroImageService],
})
export class WalletModule {}
