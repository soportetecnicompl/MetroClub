import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateComplexDto } from './dto/update-complex.dto';

/** RF-18: gestión de complejos y personal autorizado. */
@Injectable()
export class ComplexesService {
  constructor(private readonly prisma: PrismaService) {}

  /** El panel de administración necesita ver también los inactivos para poder reactivarlos. */
  findAll(includeInactive = false) {
    return this.prisma.complex.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  create(data: { name: string; city: string; address?: string }) {
    return this.prisma.complex.create({ data });
  }

  update(id: string, dto: UpdateComplexDto) {
    return this.prisma.complex.update({ where: { id }, data: dto });
  }

  /** Baja lógica — un complejo con visitas/usuarios asociados no se puede borrar físicamente. */
  deactivate(id: string) {
    return this.prisma.complex.update({ where: { id }, data: { isActive: false } });
  }
}
