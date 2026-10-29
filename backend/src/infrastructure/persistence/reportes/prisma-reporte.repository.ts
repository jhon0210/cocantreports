import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { calcularSubtotal, CambiosReporte, NuevoReporte, Reporte } from '../../../domain/reportes/reporte.entity';
import { ReporteFiltro, ReporteRepository } from '../../../domain/reportes/reporte.repository';
import { PrismaService } from '../../prisma/prisma.service';

const include = {
  material: true,
  eca: true,
  macrorutaEca: { select: { macroruta: true, nomEca: true } },
  usuario: { select: { nomUser: true, apeUser: true, usuario: true } },
  recuperador: { select: { nombre: true, apellido: true, cedula: true, caracterizacion: true } },
} satisfies Prisma.ReporteInclude;
type ReporteRow = Prisma.ReporteGetPayload<{ include: typeof include }>;

function toDomain(row: ReporteRow): Reporte {
  return {
    consecutivo: row.consecutivo,
    comprobante: row.comprobante,
    numeroReporte: row.numero_reporte,
    idMat: row.id_mat,
    material: { codigo: row.material.codigo, nombre: row.material.nomMaterial },
    cantidad: row.cantidad,
    valor: row.valor,
    subtotal: calcularSubtotal(row.cantidad, row.valor),
    idUser: row.id_user,
    usuario: { nombre: row.usuario.nomUser, apellido: row.usuario.apeUser, usuario: row.usuario.usuario },
    idEca: row.id_eca,
    eca: { nombre: row.eca.nomEca, direccion: row.eca.direccion, comuna: row.eca.comuna, codigo_nuec: row.eca.codigo_nuec },
    idEcaMacroruta: row.id_eca_macroruta,
    macroruta: row.macrorutaEca ? { codigo: row.macrorutaEca.macroruta, nombre: row.macrorutaEca.nomEca } : null,
    idRecuperador: row.id_recuperador,
    recuperador: row.recuperador ? {
      nombre: row.recuperador.nombre,
      apellido: row.recuperador.apellido,
      cedula: row.recuperador.cedula,
      tipo_documento: row.recuperador.caracterizacion && typeof row.recuperador.caracterizacion === 'object' && !Array.isArray(row.recuperador.caracterizacion) && typeof row.recuperador.caracterizacion.tipo_documento === 'string'
        ? row.recuperador.caracterizacion.tipo_documento : null,
      placa_habitual: row.recuperador.caracterizacion && typeof row.recuperador.caracterizacion === 'object' && !Array.isArray(row.recuperador.caracterizacion) && typeof row.recuperador.caracterizacion.placa_habitual === 'string'
        ? row.recuperador.caracterizacion.placa_habitual : null,
    } : null,
    fechaRegistro: row.FechaRegistro,
    fechaVenta: row.FechaVenta,
  };
}

@Injectable()
export class PrismaReporteRepository implements ReporteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(d: NuevoReporte): Promise<Reporte> {
    const row = await this.prisma.reporte.create({
      data: {
        id_mat: d.idMat,
        cantidad: d.cantidad,
        valor: d.valor,
        id_user: d.idUser,
        id_eca: d.idEca,
        id_eca_macroruta: d.idEcaMacroruta,
        id_recuperador: d.idRecuperador,
        FechaRegistro: d.fechaRegistro,
        FechaVenta: d.fechaVenta,
      },
      include,
    });
    return toDomain(row);
  }

  async findById(consecutivo: number): Promise<Reporte | null> {
    const row = await this.prisma.reporte.findUnique({ where: { consecutivo }, include });
    return row ? toDomain(row) : null;
  }

  async createBatch(registros: NuevoReporte[]): Promise<Reporte[]> {
    const comprobante = randomUUID();
    const [{ numero }] = await this.prisma.$queryRaw<Array<{ numero: number }>>`SELECT nextval('reporte_numero_seq')::int AS numero`;
    const rows = await this.prisma.$transaction(
      registros.map((d) => this.prisma.reporte.create({
        data: {
          comprobante,
          numero_reporte: numero,
          id_mat: d.idMat,
          cantidad: d.cantidad,
          valor: d.valor,
          id_user: d.idUser,
          id_eca: d.idEca,
          id_eca_macroruta: d.idEcaMacroruta,
          id_recuperador: d.idRecuperador,
          FechaRegistro: d.fechaRegistro,
          FechaVenta: d.fechaVenta,
        },
        include,
      })),
    );
    return rows.map(toDomain);
  }

  async update(consecutivo: number, d: CambiosReporte): Promise<Reporte> {
    return toDomain(await this.prisma.reporte.update({
      where: { consecutivo },
      data: {
        id_mat: d.idMat,
        cantidad: d.cantidad,
        valor: d.valor,
        id_eca: d.idEca,
        id_eca_macroruta: d.idEcaMacroruta,
        FechaVenta: d.fechaVenta,
      },
      include,
    }));
  }

  async delete(consecutivo: number): Promise<void> {
    await this.prisma.reporte.delete({ where: { consecutivo } });
  }

  async findComprobante(consecutivo: number): Promise<Reporte[]> {
    const row = await this.prisma.reporte.findUnique({ where: { consecutivo } });
    if (!row) return [];
    const rows = await this.prisma.reporte.findMany({
      where: row.comprobante ? { comprobante: row.comprobante } : { consecutivo },
      include,
      orderBy: { consecutivo: 'asc' },
    });
    return rows.map(toDomain);
  }

  async list(f: ReporteFiltro): Promise<Reporte[]> {
    const rows = await this.prisma.reporte.findMany({
      where: {
        id_user: f.idUser,
        id_eca: f.idEca,
        id_mat: f.idMat,
        ...(f.cedula ? { recuperador: { is: { cedula: f.cedula } } } : {}),
        ...((f.ventaDesde || f.ventaHasta) ? { FechaVenta: { gte: f.ventaDesde, lte: f.ventaHasta } } : {}),
        ...((f.registroDesde || f.registroHasta) ? { FechaRegistro: { gte: f.registroDesde, lte: f.registroHasta } } : {}),
      },
      include,
      orderBy: { consecutivo: 'desc' },
      take: f.limit,
      skip: f.offset,
    });
    return rows.map(toDomain);
  }
}
