import { Injectable } from '@nestjs/common';
import { EstadoRecuperador } from '../../../domain/recuperadores/estado-recuperador.entity';
import { EstadoRecuperadorRepository } from '../../../domain/recuperadores/estado-recuperador.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaEstadoRecuperadorRepository implements EstadoRecuperadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<EstadoRecuperador[]> {
    const rows = await this.prisma.estadoRecuperador.findMany({ orderBy: { id_estado: 'asc' } });
    return rows.map((e) => ({ id: e.id_estado, nombre: e.nombre }));
  }

  async findById(id: number): Promise<EstadoRecuperador | null> {
    const e = await this.prisma.estadoRecuperador.findUnique({ where: { id_estado: id } });
    return e ? { id: e.id_estado, nombre: e.nombre } : null;
  }
}
