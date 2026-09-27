import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedemptionStatus } from '@prisma/client';
import { CreateLoyaltyRuleDto } from './dto/create-loyalty-rule.dto';
import { CreateRewardDto } from './dto/create-reward.dto';

/** Aplica reglas de lealtad y gestiona premios configurables (RF-06 a RF-10). */
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveRule() {
    const rule = await this.prisma.loyaltyRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!rule) {
      throw new NotFoundException('No hay una regla de lealtad activa configurada');
    }
    return rule;
  }

  /** Calcula sellos y puntos ganados en una visita según la regla activa. */
  async calculateEarnings(amountSpent = 0) {
    const rule = await this.getActiveRule();
    const currencyUnit = Number(rule.currencyUnit) || 1;
    const pointsEarned = Math.floor((amountSpent / currencyUnit) * Number(rule.pointsPerCurrency));

    return { stampsEarned: rule.stampsPerVisit, pointsEarned };
  }

  listRewards() {
    return this.prisma.reward.findMany({ where: { isActive: true } });
  }

  /** Progreso de sellos hacia el próximo premio (usado en la tarjeta pública y en Wallet). */
  async getStampProgress(stamps: number) {
    const rewards = await this.listRewards();
    const stampRewards = rewards
      .filter((reward) => reward.stampsCost != null)
      .sort((a, b) => (a.stampsCost ?? 0) - (b.stampsCost ?? 0));

    const nextReward = stampRewards.find((reward) => (reward.stampsCost ?? 0) > stamps) ?? null;

    return {
      rewards: stampRewards.map((reward) => ({
        id: reward.id,
        name: reward.name,
        stampsCost: reward.stampsCost,
        achieved: stamps >= (reward.stampsCost ?? 0),
      })),
      nextReward: nextReward ? { name: nextReward.name, stampsCost: nextReward.stampsCost } : null,
    };
  }

  listRules() {
    return this.prisma.loyaltyRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** RF-18: crea una nueva regla de lealtad y desactiva la anterior. */
  async createRule(dto: CreateLoyaltyRuleDto) {
    return this.prisma.$transaction([
      this.prisma.loyaltyRule.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      this.prisma.loyaltyRule.create({ data: { ...dto, isActive: true } }),
    ]).then(([, rule]) => rule);
  }

  /** RF-18: crea un premio canjeable. */
  createReward(dto: CreateRewardDto) {
    return this.prisma.reward.create({ data: dto });
  }

  /** RF-10: canje de un premio; valida que el cliente tenga sellos/puntos suficientes. */
  async redeemReward(clientId: string, rewardId: string, complexId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const [client, reward] = await Promise.all([
        tx.client.findUniqueOrThrow({ where: { id: clientId } }),
        tx.reward.findUniqueOrThrow({ where: { id: rewardId } }),
      ]);

      if (reward.stampsCost && client.stamps < reward.stampsCost) {
        throw new BadRequestException('Sellos insuficientes para este premio');
      }
      if (reward.pointsCost && client.points < reward.pointsCost) {
        throw new BadRequestException('Puntos insuficientes para este premio');
      }

      await tx.client.update({
        where: { id: clientId },
        data: {
          stamps: { decrement: reward.stampsCost ?? 0 },
          points: { decrement: reward.pointsCost ?? 0 },
        },
      });

      return tx.redemption.create({
        data: {
          clientId,
          rewardId,
          complexId,
          status: RedemptionStatus.REDEEMED,
          redeemedAt: new Date(),
        },
      });
    });
  }
}
