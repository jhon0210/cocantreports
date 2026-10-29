import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CambiosUsuario, NuevoUsuario, Usuario } from '../../../domain/usuarios/usuario.entity';
import { UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { PrismaService } from '../../prisma/prisma.service';

const include = { rol: true, cargo: true, eca: { select: { nomEca: true } } } satisfies Prisma.UsuarioInclude;
type UsuarioRow = Prisma.UsuarioGetPayload<{ include: typeof include }>;

function toDomain(row: UsuarioRow): Usuario {
  return {
    id: row.id_user,
    nombre: row.nomUser ?? '',
    apellido: row.apeUser ?? '',
    usuario: row.usuario ?? '',
    claveHash: row.clave,
    cedula: row.cedula,
    idPerfil: row.id_perfil,
    perfil: row.rol?.perfil ?? null,
    idCargo: row.id_cargo,
    cargo: row.cargo?.cargo ?? null,
    idEca: row.id_eca,
    eca: row.eca?.nomEca ?? null,
    activo: row.activo,
  };
}

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Usuario | null> {
    const row = await this.prisma.usuario.findUnique({ where: { id_user: id }, include });
    return row ? toDomain(row) : null;
  }

  async findByUsuario(usuario: string): Promise<Usuario | null> {
    const row = await this.prisma.usuario.findUnique({ where: { usuario }, include });
    return row ? toDomain(row) : null;
  }

  async findByCedula(cedula: number): Promise<Usuario | null> {
    const row = await this.prisma.usuario.findFirst({ where: { cedula }, include });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Usuario[]> {
    const rows = await this.prisma.usuario.findMany({ include, orderBy: { id_user: 'asc' } });
    return rows.map(toDomain);
  }

  async create(data: NuevoUsuario): Promise<Usuario> {
    const row = await this.prisma.usuario.create({
      data: {
        nomUser: data.nombre,
        apeUser: data.apellido,
        usuario: data.usuario,
        clave: data.claveHash,
        cedula: data.cedula,
        id_perfil: data.idPerfil,
        id_cargo: data.idCargo,
        id_eca: data.idEca,
      },
      include,
    });
    return toDomain(row);
  }

  async update(id: number, c: CambiosUsuario): Promise<Usuario> {
    const row = await this.prisma.usuario.update({
      where: { id_user: id },
      data: {
        nomUser: c.nombre,
        apeUser: c.apellido,
        usuario: c.usuario,
        cedula: c.cedula,
        id_perfil: c.idPerfil,
        id_cargo: c.idCargo,
        id_eca: c.idEca,
        activo: c.activo,
        clave: c.claveHash,
      },
      include,
    });
    return toDomain(row);
  }
}
