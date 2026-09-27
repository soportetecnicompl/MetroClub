import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** RF-17: dashboard de métricas y KPIs. RF-19: exportación de base de clientes. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(complexId?: string) {
    const visitWhere = complexId ? { complexId } : undefined;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      activeClients,
      totalVisits,
      totalRedemptions,
      reviewsRequested,
      newClientsThisMonth,
      visitsByClient,
      topComplexesRaw,
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

    return {
      activeClients,
      totalVisits,
      totalRedemptions,
      reviewsRequested,
      newClientsThisMonth,
      retentionRate,
      avgVisitsPerClient,
      topComplexes,
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
