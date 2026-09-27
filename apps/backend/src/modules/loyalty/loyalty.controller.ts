import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoyaltyService } from './loyalty.service';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { CreateLoyaltyRuleDto } from './dto/create-loyalty-rule.dto';
import { CreateRewardDto } from './dto/create-reward.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('rules')
  listRules() {
    return this.loyaltyService.listRules();
  }

  @Post('rules')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createRule(@Body() dto: CreateLoyaltyRuleDto) {
    return this.loyaltyService.createRule(dto);
  }

  @Get('rewards')
  listRewards() {
    return this.loyaltyService.listRewards();
  }

  @Post('rewards')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createReward(@Body() dto: CreateRewardDto) {
    return this.loyaltyService.createReward(dto);
  }

  @Post('redemptions')
  redeem(@Body() dto: RedeemRewardDto) {
    return this.loyaltyService.redeemReward(dto.clientId, dto.rewardId, dto.complexId);
  }
}
