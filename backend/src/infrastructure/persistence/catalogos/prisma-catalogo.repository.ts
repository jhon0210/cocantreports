import { Injectable } from '@nestjs/common';
import { Cargo, Rol } from '../../../domain/catalogos/catalogo.entity';
import { CatalogoRepository } from '../../../domain/catalogos/catalogo.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaCatalogoRepository implements CatalogoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(): Promise<Rol[]> {
    const rows = await this.prisma.rol.findMany({ orderBy: { id_perfil: 'asc' } });
    return rows.map((r) => ({ id: r.id_perfil, perfil: r.perfil ?? '' }));
  }

  async findRolById(id: number): Promise<Rol | null> {
    const r = await this.prisma.rol.findUnique({ where: { id_perfil: id } });
    return r ? { id: r.id_perfil, perfil: r.perfil ?? '' } : null;
  }

  async listCargos(): Promise<Cargo[]> {
    const rows = await this.prisma.cargo.findMany({ orderBy: { id_cargo: 'asc' } });
    return rows.map((c) => ({ id: c.id_cargo, cargo: c.cargo ?? '', estado: c.estado }));
  }

  async findCargoById(id: number): Promise<Cargo | null> {
    const c = await this.prisma.cargo.findUnique({ where: { id_cargo: id } });
    return c ? { id: c.id_cargo, cargo: c.cargo ?? '', estado: c.estado } : null;
  }
}
