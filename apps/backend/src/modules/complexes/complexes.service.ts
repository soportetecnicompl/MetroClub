import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** RF-18: gestión de complejos y personal autorizado. */
@Injectable()
export class ComplexesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.complex.findMany({ where: { isActive: true } });
  }

  create(data: { name: string; city: string; address?: string }) {
    return this.prisma.complex.create({ data });
  }
}
