import { Injectable } from '@nestjs/common';
import { Promotion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

export interface PromotionMatchContext {
  isMetroClub: boolean;
  movieId: string;
  format: string;
  complexId: string;
}

/**
 * Motor de promociones: reemplaza el 10% fijo (METROCLUB_DISCOUNT_PERCENT) por descuentos
 * configurables desde el admin. Nunca se combinan promociones en un mismo boleto: si más
 * de una aplica, gana la que da el mayor descuento en Lempiras (no hay campo de prioridad).
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  list() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  update(id: string, dto: UpdatePromotionDto) {
    return this.prisma.promotion.update({ where: { id }, data: dto });
  }

  /** Descuento en Lempiras que otorgaría esta promoción sobre un precio base dado. */
  private discountFor(promotion: Promotion, basePrice: number): number {
    const raw =
      promotion.type === 'PERCENT_OFF' ? basePrice * (Number(promotion.value) / 100) : Number(promotion.value);
    return Number(Math.min(raw, basePrice).toFixed(2));
  }

  /**
   * Busca, entre las promociones activas y vigentes que apliquen al contexto de la venta,
   * la que otorga el mayor descuento. Devuelve null si ninguna aplica (p. ej. cliente sin
   * identificar y todas las promociones activas requieren MetroClub).
   */
  async getApplicablePromotion(
    context: PromotionMatchContext,
    basePrice: number,
  ): Promise<{ promotion: Promotion; discountApplied: number } | null> {
    const now = new Date();
    const candidates = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
    });

    const applicable = candidates.filter((promo) => {
      if (promo.endsAt && promo.endsAt < now) return false;
      if (promo.requiresMetroClub && !context.isMetroClub) return false;

      switch (promo.scope) {
        case 'ALL_TICKETS':
          return true;
        case 'MOVIE':
          return promo.movieId === context.movieId;
        case 'FORMAT':
          return promo.format === context.format;
        case 'COMPLEX':
          return promo.complexId === context.complexId;
        default:
          return false;
      }
    });

    if (applicable.length === 0) return null;

    const best = applicable
      .map((promotion) => ({ promotion, discountApplied: this.discountFor(promotion, basePrice) }))
      .sort((a, b) => b.discountApplied - a.discountApplied)[0];

    return best;
  }
}
