import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface Pagination {
  page?: number;
  limit?: number;
}

function normalizePagination({ page, limit }: Pagination) {
  return {
    page: page && page > 0 ? page : 1,
    limit: limit && limit > 0 ? Math.min(limit, 100) : 20,
  };
}

/** Suma del valor monetario (L.) de un conjunto de canjes — para saber cuánto ha "costado" el programa. */
async function sumRedemptionCost(
  prisma: PrismaService,
  where: Prisma.RedemptionWhereInput,
): Promise<number> {
  const redemptions = await prisma.redemption.findMany({
    where,
    select: { reward: { select: { monetaryValue: true } } },
  });
  return redemptions.reduce((sum, r) => sum + (r.reward.monetaryValue ? Number(r.reward.monetaryValue) : 0), 0);
}

export type ClientSegment = 'active' | 'at_risk' | 'dormant' | 'lost' | 'never';

/**
 * Umbrales de recencia (días desde la última visita) para segmentar la base:
 * activo = viene seguido, en_riesgo/dormido = candidato a win-back, perdido = ya se fue.
 * Único origen de verdad — tanto el filtro de /reports/clients como los conteos del
 * dashboard usan estos mismos números para no desalinearse.
 */
const SEGMENT_THRESHOLDS_DAYS = { active: 30, atRisk: 60, dormant: 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function computeSegment(lastVisitAt: Date | null, now: Date): ClientSegment {
  if (!lastVisitAt) return 'never';
  const days = daysSince(lastVisitAt, now);
  if (days <= SEGMENT_THRESHOLDS_DAYS.active) return 'active';
  if (days <= SEGMENT_THRESHOLDS_DAYS.atRisk) return 'at_risk';
  if (days <= SEGMENT_THRESHOLDS_DAYS.dormant) return 'dormant';
  return 'lost';
}

export function segmentWhere(segment: ClientSegment, now: Date): Prisma.ClientWhereInput {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  switch (segment) {
    case 'never':
      return { lastVisitAt: null };
    case 'active':
      return { lastVisitAt: { gte: before(SEGMENT_THRESHOLDS_DAYS.active) } };
    case 'at_risk':
      return {
        lastVisitAt: { lt: before(SEGMENT_THRESHOLDS_DAYS.active), gte: before(SEGMENT_THRESHOLDS_DAYS.atRisk) },
      };
    case 'dormant':
      return {
        lastVisitAt: { lt: before(SEGMENT_THRESHOLDS_DAYS.atRisk), gte: before(SEGMENT_THRESHOLDS_DAYS.dormant) },
      };
    case 'lost':
      return { lastVisitAt: { lt: before(SEGMENT_THRESHOLDS_DAYS.dormant) } };
  }
}

/** RF-17: dashboard de métricas y KPIs. RF-19: exportación de base de clientes. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista paginada de clientes con sellos/puntos/gasto y su segmento de recencia. */
  async listClients(
    params: Pagination & {
      search?: string;
      sortBy?: 'stamps' | 'points' | 'lastVisitAt' | 'createdAt' | 'totalSpent';
      segment?: ClientSegment;
    },
  ) {
    const { page, limit } = normalizePagination(params);
    const now = new Date();
    const where: Prisma.ClientWhereInput = {
      isDeleted: false,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { whatsapp: { contains: params.search } },
            ],
          }
        : {}),
      ...(params.segment ? segmentWhere(params.segment, now) : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { [params.sortBy ?? 'lastVisitAt']: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          whatsapp: true,
          stamps: true,
          points: true,
          totalSpent: true,
          lastVisitAt: true,
          createdAt: true,
          _count: { select: { visits: true, redemptions: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const data = rows.map((client) => ({ ...client, segment: computeSegment(client.lastVisitAt, now) }));

    return { data, total, page, limit };
  }

  /** RF-10 / negocio: historial de canjes con su costo real (L.) — no solo cuántos, sino qué tan caro sale el programa. */
  async listRedemptions(params: Pagination & { complexId?: string }) {
    const { page, limit } = normalizePagination(params);
    const where: Prisma.RedemptionWhereInput = params.complexId ? { complexId: params.complexId } : {};

    const [data, total, totalCost] = await Promise.all([
      this.prisma.redemption.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: { select: { id: true, name: true, whatsapp: true } },
          reward: { select: { id: true, name: true, stampsCost: true, pointsCost: true, monetaryValue: true } },
          complex: { select: { id: true, name: true } },
        },
      }),
      this.prisma.redemption.count({ where }),
      sumRedemptionCost(this.prisma, where),
    ]);

    return { data, total, page, limit, totalCost };
  }

  async getDashboardSummary(complexId?: string) {
    const visitWhere = complexId ? { complexId } : undefined;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const now = new Date();
    const SEGMENTS: ClientSegment[] = ['active', 'at_risk', 'dormant', 'lost', 'never'];

    const [
      activeClients,
      totalVisits,
      totalRedemptions,
      reviewsRequested,
      newClientsThisMonth,
      visitsByClient,
      topComplexesRaw,
      totalRedemptionCost,
      pointsLiability,
      topRewardsRaw,
      segmentCounts,
      clientsWithRedemptions,
      lifetimeRevenue,
    ] = await Promise.all([
      this.prisma.client.count({ where: { isDeleted: false } }),
      this.prisma.visit.count({ where: visitWhere }),
      this.prisma.redemption.count({ where: { complexId } }),
      this.prisma.whatsAppMessage.count({ where: { type: 'REVIEW_REQUEST' } }),
      this.prisma.client.count({ where: { isDeleted: false, createdAt: { gte: startOfMonth } } }),
      this.prisma.visit.groupBy({ by: ['clientId'], where: visitWhere, _count: true }),
      this.prisma.visit.groupBy({
        by: ['complexId'],
        _count: true,
        orderBy: { _count: { complexId: 'desc' } },
        take: 5,
      }),
      // Cuánto le ha costado (en L.) el programa de lealtad al negocio hasta ahora.
      sumRedemptionCost(this.prisma, { complexId }),
      // Sellos/puntos que los clientes activos todavía tienen sin canjear (pasivo del programa).
      this.prisma.client.aggregate({ where: { isDeleted: false }, _sum: { points: true, stamps: true } }),
      this.prisma.redemption.groupBy({
        by: ['rewardId'],
        where: { complexId },
        _count: true,
        orderBy: { _count: { rewardId: 'desc' } },
        take: 5,
      }),
      // Cuántos clientes están activos/en riesgo/dormidos/perdidos — para saber a quién
      // "atacar" con reactivación en vez de solo ver el promedio de retención.
      Promise.all(
        SEGMENTS.map((segment) =>
          this.prisma.client.count({ where: { isDeleted: false, ...segmentWhere(segment, now) } }),
        ),
      ),
      // Tasa de canje: de los inscritos, ¿cuántos realmente usan sus sellos/puntos?
      this.prisma.client.count({ where: { isDeleted: false, redemptions: { some: {} } } }),
      // Valor de vida (L.) generado por toda la base — para medir el ROI real del programa.
      this.prisma.client.aggregate({ where: { isDeleted: false }, _sum: { totalSpent: true } }),
    ]);

    const clientsWithVisits = visitsByClient.length;
    const returningClients = visitsByClient.filter((v) => v._count >= 2).length;
    const retentionRate = clientsWithVisits > 0 ? Math.round((returningClients / clientsWithVisits) * 100) : 0;
    const avgVisitsPerClient = activeClients > 0 ? Number((totalVisits / activeClients).toFixed(1)) : 0;

    const complexes = await this.prisma.complex.findMany({
      where: { id: { in: topComplexesRaw.map((c) => c.complexId) } },
      select: { id: true, name: true },
    });
    const topComplexes = topComplexesRaw.map((c) => ({
      complexId: c.complexId,
      name: complexes.find((complex) => complex.id === c.complexId)?.name ?? 'Desconocido',
      visits: c._count,
    }));

    const rewards = await this.prisma.reward.findMany({
      where: { id: { in: topRewardsRaw.map((r) => r.rewardId) } },
      select: { id: true, name: true },
    });
    const topRewards = topRewardsRaw.map((r) => ({
      rewardId: r.rewardId,
      name: rewards.find((reward) => reward.id === r.rewardId)?.name ?? 'Desconocido',
      redemptions: r._count,
    }));

    const clientsBySegment = Object.fromEntries(SEGMENTS.map((segment, i) => [segment, segmentCounts[i]])) as Record<
      ClientSegment,
      number
    >;
    const redemptionRate = activeClients > 0 ? Math.round((clientsWithRedemptions / activeClients) * 100) : 0;

    return {
      activeClients,
      totalVisits,
      totalRedemptions,
      reviewsRequested,
      newClientsThisMonth,
      retentionRate,
      avgVisitsPerClient,
      topComplexes,
      topRewards,
      totalRedemptionCost,
      pointsOutstanding: pointsLiability._sum.points ?? 0,
      stampsOutstanding: pointsLiability._sum.stamps ?? 0,
      clientsBySegment,
      redemptionRate,
      lifetimeRevenue: Number(lifetimeRevenue._sum.totalSpent ?? 0),
    };
  }

  async exportClientsCsv() {
    const clients = await this.prisma.client.findMany({ where: { isDeleted: false } });
    const header = 'id,name,whatsapp,stamps,points,lastVisitAt\n';
    const rows = clients
      .map((c) => [c.id, c.name, c.whatsapp, c.stamps, c.points, c.lastVisitAt?.toISOString() ?? ''].join(','))
      .join('\n');
    return header + rows;
  }
}
