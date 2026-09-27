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

/**
 * Suma del costo real (L.) de un conjunto de canjes — para saber cuánto ha "costado" el
 * programa. Usa `costAtRedemption` (precio congelado al momento del canje), NUNCA el
 * `reward.monetaryValue` actual: si un admin edita después el precio de un premio, la
 * suma no debe cambiar retroactivamente para canjes ya hechos.
 */
async function sumRedemptionCost(
  prisma: PrismaService,
  where: Prisma.RedemptionWhereInput,
): Promise<number> {
  const result = await prisma.redemption.aggregate({ where, _sum: { costAtRedemption: true } });
  return Number(result._sum.costAtRedemption ?? 0);
}

/**
 * Reparte 100% entre `values` como enteros que SIEMPRE suman exactamente 100 (método del
 * mayor resto / Hamilton). Redondear cada porcentaje por separado con Math.round() no
 * garantiza esto — p. ej. 3 premios con 1/3 del costo cada uno redondean a 33% y suman 99%,
 * o un reparto de 33/33/34 puede sumar 100 o 101 según el caso. Aquí se asigna primero el
 * piso de cada uno y el resto de puntos (100 - suma de pisos) se da, de a uno, a quienes
 * tengan el mayor residuo decimal — así ninguno se aleja más de 1pp de su parte exacta y
 * el total siempre cierra en 100 (o en 0 si todos los valores son 0).
 */
function distributePercentPoints(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);

  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  const remainders = raw.map((r, i) => ({ i, remainder: r - floors[i] }));
  let pointsLeft = 100 - floors.reduce((sum, f) => sum + f, 0);

  remainders.sort((a, b) => b.remainder - a.remainder);
  const result = [...floors];
  for (const { i } of remainders) {
    if (pointsLeft <= 0) break;
    result[i] += 1;
    pointsLeft -= 1;
  }
  return result;
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

/**
 * Medianoche del día calendario de `date` — ancla tanto `daysSince` como `segmentWhere`
 * a los mismos límites de día calendario. Antes `daysSince` truncaba con floor() una
 * diferencia continua mientras `segmentWhere` comparaba contra un instante continuo
 * (now - N*DAY_MS): con horas de por medio (p. ej. una visita hace 30.5 días), el badge
 * mostrado por daysSince decía "activo" pero el filtro segmentWhere lo excluía de
 * "activo" y lo devolvía en "en riesgo" — un cliente que se veía activo pero no
 * aparecía al filtrar por activos. Al anclar ambos a medianoche, "días desde" queda como
 * un entero exacto de días calendario y el filtro usa el mismo corte, sin desacuerdos.
 */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysSince(date: Date, now: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
}

function computeSegment(lastVisitAt: Date | null, now: Date): ClientSegment {
  if (!lastVisitAt) return 'never';
  const days = daysSince(lastVisitAt, now);
  if (days <= SEGMENT_THRESHOLDS_DAYS.active) return 'active';
  if (days <= SEGMENT_THRESHOLDS_DAYS.atRisk) return 'at_risk';
  if (days <= SEGMENT_THRESHOLDS_DAYS.dormant) return 'dormant';
  return 'lost';
}

/** Texto accionable por segmento — qué hacer con ESTE cliente, no solo en qué grupo está. */
const SEGMENT_RECOMMENDATIONS: Record<ClientSegment, string> = {
  active: 'Cliente frecuente: prioriza retenerlo con un premio o beneficio exclusivo antes de que se enfríe.',
  at_risk: 'Empezó a espaciarse — envíale ya un recordatorio o promoción puntual, todavía es fácil traerlo de vuelta.',
  dormant: 'Lleva 2-3 meses sin venir — necesita una campaña de reactivación concreta (descuento u oferta por tiempo limitado).',
  lost: 'Prácticamente perdido — solo una oferta agresiva (2x1, descuento fuerte) lo trae de vuelta; evalúa si el costo vale la pena.',
  never: 'Se enroló pero nunca volvió — el enganche inicial falló; una oferta de bienvenida con vencimiento corto puede activarlo.',
};

export function segmentWhere(segment: ClientSegment, now: Date): Prisma.ClientWhereInput {
  // Medianoche de "hace N días" — cualquier lastVisitAt en o después de ese instante
  // cae en un día calendario a <=N días de hoy, exactamente lo que evalúa daysSince.
  const before = (days: number) => new Date(startOfDay(now).getTime() - days * DAY_MS);
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

  /**
   * Ficha de "costo vs. beneficio + qué hacer" de un cliente — lo que se muestra en su
   * pantalla de detalle: cuánto ha generado vs. cuánto ha costado en premios, qué tan
   * cerca está de su próximo premio (potencial), y una recomendación concreta de acción
   * según su segmento de recencia.
   */
  async getClientInsights(clientId: string) {
    const now = new Date();
    const client = await this.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        stamps: true,
        totalSpent: true,
        lastVisitAt: true,
        _count: { select: { visits: true, redemptions: true } },
      },
    });

    const [redemptionCost, rewards] = await Promise.all([
      sumRedemptionCost(this.prisma, { clientId }),
      this.prisma.reward.findMany({
        where: { isActive: true, stampsCost: { not: null } },
        orderBy: { stampsCost: 'asc' },
        select: { name: true, stampsCost: true },
      }),
    ]);

    const segment = computeSegment(client.lastVisitAt, now);
    const totalSpent = Number(client.totalSpent);
    const nextReward = rewards.find((r) => (r.stampsCost ?? 0) > client.stamps) ?? null;

    return {
      segment,
      totalSpent,
      redemptionCost,
      netValue: totalSpent - redemptionCost,
      avgSpendPerVisit: client._count.visits > 0 ? Number((totalSpent / client._count.visits).toFixed(2)) : 0,
      daysSinceLastVisit: client.lastVisitAt ? daysSince(client.lastVisitAt, now) : null,
      visits: client._count.visits,
      redemptions: client._count.redemptions,
      nextReward: nextReward ? { name: nextReward.name, stampsCost: nextReward.stampsCost } : null,
      stampsToNextReward: nextReward ? (nextReward.stampsCost ?? 0) - client.stamps : null,
      recommendation: SEGMENT_RECOMMENDATIONS[segment],
    };
  }

  /**
   * Inteligencia de negocio: costo de cada premio vs. lo que realmente se está
   * canjeando, para validar si el programa de lealtad se paga solo. No basta con
   * "cuánto ha costado en total" (ya en el dashboard) — hay que ver premio por premio
   * cuál concentra el gasto, y si los clientes que canjean gastan más que los que no
   * (si no gastan más, el programa es puro costo sin ningún efecto de retención real).
   */
  async getRewardsRoi() {
    const [rewards, redemptionsByReward, revenueAgg, redeemersAgg, nonRedeemersAgg] = await Promise.all([
      this.prisma.reward.findMany({
        select: { id: true, name: true, isActive: true, stampsCost: true, pointsCost: true, monetaryValue: true },
      }),
      // _sum.costAtRedemption (no monetaryValue actual × conteo): si el precio del premio
      // cambió después de algunos canjes, esto sigue reflejando lo que REALMENTE costó.
      this.prisma.redemption.groupBy({ by: ['rewardId'], _count: true, _sum: { costAtRedemption: true } }),
      this.prisma.client.aggregate({ where: { isDeleted: false }, _sum: { totalSpent: true } }),
      this.prisma.client.aggregate({
        where: { isDeleted: false, redemptions: { some: {} } },
        _avg: { totalSpent: true },
        _count: true,
      }),
      this.prisma.client.aggregate({
        where: { isDeleted: false, redemptions: { none: {} } },
        _avg: { totalSpent: true },
        _count: true,
      }),
    ]);

    const rewardStats = rewards
      .map((reward) => {
        const agg = redemptionsByReward.find((r) => r.rewardId === reward.id);
        return {
          rewardId: reward.id,
          name: reward.name,
          isActive: reward.isActive,
          stampsCost: reward.stampsCost,
          pointsCost: reward.pointsCost,
          // Precio configurado HOY (referencia) — puede no coincidir con lo que costaron
          // canjes pasados si el precio cambió; para eso está totalCost, ya exacto.
          currentUnitCost: reward.monetaryValue ? Number(reward.monetaryValue) : 0,
          timesRedeemed: agg?._count ?? 0,
          totalCost: Number(agg?._sum.costAtRedemption ?? 0),
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    const totalCost = rewardStats.reduce((sum, r) => sum + r.totalCost, 0);
    const totalRevenue = Number(revenueAgg._sum.totalSpent ?? 0);
    const avgSpendRedeemers = Number(redeemersAgg._avg.totalSpent ?? 0);
    const avgSpendNonRedeemers = Number(nonRedeemersAgg._avg.totalSpent ?? 0);

    // % del costo total del programa que se va en cada premio — repartido para que
    // siempre sume exactamente 100% entre todos los premios (ver distributePercentPoints).
    const costShares = distributePercentPoints(rewardStats.map((r) => r.totalCost));

    return {
      rewards: rewardStats.map((r, i) => ({ ...r, costSharePercent: costShares[i] })),
      totalCost,
      totalRevenue,
      // Cuánto del ingreso total de la base se está yendo en premios (entre menos, mejor).
      costToRevenuePercent: totalRevenue > 0 ? Number(((totalCost / totalRevenue) * 100).toFixed(1)) : null,
      avgSpendRedeemers,
      avgSpendNonRedeemers,
      redeemersCount: redeemersAgg._count,
      nonRedeemersCount: nonRedeemersAgg._count,
      // La señal real de ROI: ¿los que canjean premios gastan más que los que no? Si es
      // negativo, el programa no está generando el comportamiento que se busca.
      spendLift: avgSpendRedeemers - avgSpendNonRedeemers,
    };
  }

  /**
   * Tendencia mensual — sin esto el dashboard solo muestra una foto del momento: no hay
   * forma de saber si la retención/costo/base en riesgo viene mejorando o empeorando.
   * Todo se reconstruye de filas reales con fecha (visitas, canjes, clientes), incluyendo
   * la mezcla de segmentos "como estaba" al cierre de cada mes (no solo hoy).
   */
  async getTrends(months = 6) {
    const clampedMonths = Math.min(Math.max(Math.floor(months) || 6, 1), 24);
    const now = new Date();

    const [clients, visits, redemptions] = await Promise.all([
      this.prisma.client.findMany({ where: { isDeleted: false }, select: { id: true, createdAt: true } }),
      this.prisma.visit.findMany({ select: { clientId: true, createdAt: true, amountSpent: true } }),
      this.prisma.redemption.findMany({ select: { createdAt: true, costAtRedemption: true } }),
    ]);

    // Fechas de visita por cliente, ordenadas — para saber cuál era su "última visita"
    // como estaba al cierre de cualquier mes pasado, no solo hoy.
    const visitDatesByClient = new Map<string, Date[]>();
    for (const v of visits) {
      const arr = visitDatesByClient.get(v.clientId) ?? [];
      arr.push(v.createdAt);
      visitDatesByClient.set(v.clientId, arr);
    }
    for (const arr of visitDatesByClient.values()) arr.sort((a, b) => a.getTime() - b.getTime());

    const lastVisitAsOf = (clientId: string, asOf: Date): Date | null => {
      const dates = visitDatesByClient.get(clientId);
      if (!dates) return null;
      let result: Date | null = null;
      for (const d of dates) {
        if (d <= asOf) result = d;
        else break;
      }
      return result;
    };

    const monthStarts: Date[] = [];
    for (let i = clampedMonths - 1; i >= 0; i--) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    let previousMonthClientIds: Set<string> | null = null;

    const points = monthStarts.map((monthStart) => {
      const monthEndRaw = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthEnd = monthEndRaw > now ? now : monthEndRaw;

      const monthVisits = visits.filter((v) => v.createdAt >= monthStart && v.createdAt <= monthEnd);
      const monthRedemptions = redemptions.filter((r) => r.createdAt >= monthStart && r.createdAt <= monthEnd);
      const newClients = clients.filter((c) => c.createdAt >= monthStart && c.createdAt <= monthEnd).length;

      const revenue = monthVisits.reduce((sum, v) => sum + (v.amountSpent ? Number(v.amountSpent) : 0), 0);
      const redemptionCost = monthRedemptions.reduce(
        (sum, r) => sum + (r.costAtRedemption ? Number(r.costAtRedemption) : 0),
        0,
      );

      const segmentCounts: Record<ClientSegment, number> = { active: 0, at_risk: 0, dormant: 0, lost: 0, never: 0 };
      for (const client of clients) {
        if (client.createdAt > monthEnd) continue; // todavía no se había enrolado
        segmentCounts[computeSegment(lastVisitAsOf(client.id, monthEnd), monthEnd)] += 1;
      }

      // Retención mensual clásica: de quienes vinieron el mes pasado, ¿cuántos también
      // vinieron este mes? (null en el primer punto de la ventana: no hay mes previo).
      const thisMonthClientIds = new Set(monthVisits.map((v) => v.clientId));
      let monthlyRetentionRate: number | null = null;
      if (previousMonthClientIds && previousMonthClientIds.size > 0) {
        let returning = 0;
        for (const id of previousMonthClientIds) {
          if (thisMonthClientIds.has(id)) returning += 1;
        }
        monthlyRetentionRate = Math.round((returning / previousMonthClientIds.size) * 100);
      }
      previousMonthClientIds = thisMonthClientIds;

      return {
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        newClients,
        visits: monthVisits.length,
        revenue,
        redemptions: monthRedemptions.length,
        redemptionCost,
        costToRevenuePercent: revenue > 0 ? Number(((redemptionCost / revenue) * 100).toFixed(1)) : null,
        monthlyRetentionRate,
        clientsBySegment: segmentCounts,
      };
    });

    return { points };
  }

  /**
   * Compara complejos entre sí (no solo cuál tiene más tráfico, ver "topComplexes" del
   * dashboard) — retención, gasto promedio y costo de premios por sucursal, para saber
   * cuál realmente funciona mejor y no solo cuál mueve más gente.
   */
  async getComplexComparison() {
    const complexes = await this.prisma.complex.findMany({ where: { isActive: true } });

    const rows = await Promise.all(
      complexes.map(async (complex) => {
        const [visits, redemptionCost, redemptionsCount, visitsByClient] = await Promise.all([
          this.prisma.visit.findMany({ where: { complexId: complex.id }, select: { amountSpent: true } }),
          sumRedemptionCost(this.prisma, { complexId: complex.id }),
          this.prisma.redemption.count({ where: { complexId: complex.id } }),
          this.prisma.visit.groupBy({ by: ['clientId'], where: { complexId: complex.id }, _count: true }),
        ]);

        const revenue = visits.reduce((sum, v) => sum + (v.amountSpent ? Number(v.amountSpent) : 0), 0);
        const distinctClients = visitsByClient.length;
        const returningClients = visitsByClient.filter((v) => v._count >= 2).length;

        return {
          complexId: complex.id,
          name: complex.name,
          city: complex.city,
          visits: visits.length,
          distinctClients,
          revenue,
          avgSpendPerVisit: visits.length > 0 ? Number((revenue / visits.length).toFixed(2)) : 0,
          redemptions: redemptionsCount,
          redemptionCost,
          retentionRate: distinctClients > 0 ? Math.round((returningClients / distinctClients) * 100) : 0,
        };
      }),
    );

    return rows.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Alertas proactivas: en vez de obligar al gerente a entrar a revisar cada KPI, se
   * comparan los últimos dos meses de `getTrends` y se avisa cuando algo se mueve lo
   * suficiente como para requerir acción — para bien o para mal. Umbrales deliberadamente
   * conservadores para no generar ruido con la base pequeña de un piloto.
   */
  async getAlerts() {
    const { points } = await this.getTrends(2);
    const alerts: { level: 'warning' | 'success' | 'info'; title: string; detail: string }[] = [];

    if (points.length < 2) {
      return { alerts: [] };
    }

    const [prev, curr] = points;
    const prevAtRisk = prev.clientsBySegment.at_risk + prev.clientsBySegment.dormant + prev.clientsBySegment.lost;
    const currAtRisk = curr.clientsBySegment.at_risk + curr.clientsBySegment.dormant + curr.clientsBySegment.lost;

    if (prevAtRisk > 0 && currAtRisk >= prevAtRisk * 1.2 && currAtRisk - prevAtRisk >= 2) {
      const growth = Math.round(((currAtRisk - prevAtRisk) / prevAtRisk) * 100);
      alerts.push({
        level: 'warning',
        title: `La base en riesgo/dormida/perdida creció ${growth}%`,
        detail: `Pasó de ${prevAtRisk} a ${currAtRisk} clientes sin visitar recientemente. Envíales una campaña de reactivación desde /clients.`,
      });
    } else if (currAtRisk > 0 && currAtRisk <= prevAtRisk * 0.8 && prevAtRisk - currAtRisk >= 2) {
      alerts.push({
        level: 'success',
        title: 'La base en riesgo/dormida/perdida se redujo',
        detail: `Pasó de ${prevAtRisk} a ${currAtRisk} clientes — las campañas de reactivación están funcionando.`,
      });
    }

    if (
      prev.monthlyRetentionRate != null &&
      curr.monthlyRetentionRate != null &&
      prev.monthlyRetentionRate - curr.monthlyRetentionRate >= 15
    ) {
      alerts.push({
        level: 'warning',
        title: `La retención mensual bajó ${prev.monthlyRetentionRate - curr.monthlyRetentionRate} puntos`,
        detail: `De ${prev.monthlyRetentionRate}% a ${curr.monthlyRetentionRate}% de clientes que repiten mes a mes.`,
      });
    }

    if (
      prev.costToRevenuePercent != null &&
      curr.costToRevenuePercent != null &&
      curr.costToRevenuePercent - prev.costToRevenuePercent >= 5
    ) {
      alerts.push({
        level: 'warning',
        title: 'El costo del programa como % de ingresos subió',
        detail: `De ${prev.costToRevenuePercent}% a ${curr.costToRevenuePercent}% — revisa el ROI por premio en /roi.`,
      });
    }

    if (prev.newClients > 0 && curr.newClients <= prev.newClients * 0.7 && prev.newClients - curr.newClients >= 2) {
      alerts.push({
        level: 'warning',
        title: 'Bajó el enrolamiento de nuevos clientes',
        detail: `De ${prev.newClients} a ${curr.newClients} clientes nuevos este mes — revisa el flujo de auto-enrolamiento (/join) en taquilla.`,
      });
    }

    return { alerts };
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
