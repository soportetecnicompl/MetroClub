import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoyaltyService } from './loyalty.service';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { CreateLoyaltyRuleDto } from './dto/create-loyalty-rule.dto';
import { UpdateLoyaltyRuleDto } from './dto/update-loyalty-rule.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

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

  @Patch('rules/:id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  updateRule(@Param('id') id: string, @Body() dto: UpdateLoyaltyRuleDto) {
    return this.loyaltyService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  deactivateRule(@Param('id') id: string) {
    return this.loyaltyService.deactivateRule(id);
  }

  @Get('rewards')
  listRewards(@Query('includeInactive') includeInactive?: string) {
    return this.loyaltyService.listRewards(includeInactive === 'true');
  }

  @Post('rewards')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createReward(@Body() dto: CreateRewardDto) {
    return this.loyaltyService.createReward(dto);
  }

  @Patch('rewards/:id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.loyaltyService.updateReward(id, dto);
  }

  @Delete('rewards/:id')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  deactivateReward(@Param('id') id: string) {
    return this.loyaltyService.deactivateReward(id);
  }

  @Post('redemptions')
  redeem(@Body() dto: RedeemRewardDto) {
    return this.loyaltyService.redeemReward(dto.clientId, dto.rewardId, dto.complexId);
  }
}
