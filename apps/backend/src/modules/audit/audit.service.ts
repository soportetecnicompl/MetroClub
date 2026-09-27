import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** NFR-07: logs de auditoría. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(action: string, clientId?: string, actorId?: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { action, clientId, actorId, metadata } });
  }

  findByClient(clientId: string) {
    return this.prisma.auditLog.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }
}
