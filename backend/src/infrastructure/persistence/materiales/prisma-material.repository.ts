import { Injectable } from '@nestjs/common';
import { Material } from '../../../domain/materiales/material.entity';
import { MaterialRepository } from '../../../domain/materiales/material.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaMaterialRepository implements MaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Material[]> {
    const rows = await this.prisma.material.findMany({ orderBy: [{ codigo: 'asc' }, { id_mat: 'asc' }] });
    return rows.map((m) => ({ id: m.id_mat, codigo: m.codigo, nombre: m.nomMaterial }));
  }

  async findById(id: number): Promise<Material | null> {
    const m = await this.prisma.material.findUnique({ where: { id_mat: id } });
    return m ? { id: m.id_mat, codigo: m.codigo, nombre: m.nomMaterial } : null;
  }
}
