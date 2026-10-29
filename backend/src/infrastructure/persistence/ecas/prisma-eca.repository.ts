import { Inject, Injectable } from '@nestjs/common';
import { Eca as EcaRow, Prisma } from '@prisma/client';
import { CambioAdjuntoEca, CambiosEca, Eca, NuevaEca } from '../../../domain/ecas/eca.entity';
import { EcaRepository } from '../../../domain/ecas/eca.repository';
import { ValidationError } from '../../../domain/shared/domain-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaArchivoRepository } from '../../storage/prisma-archivo.repository';
import { OBJECT_STORAGE, ObjectStorage } from '../../../application/ports/object-storage.port';

const adjuntosSelect = { id: true, nombre: true, tamano: true } as const;
const include = { adjuntos: { select: adjuntosSelect, orderBy: { id: 'asc' as const } } };

export function ecaToDomain(row: EcaRow & { adjuntos?: Eca['adjuntos'] }): Eca {
  return {
    id: row.id_eca,
    nombre: row.nomEca,
    direccion: row.direccion,
    comuna: row.comuna,
    estado: row.estado,
    categoria: row.categoria,
    ruta: row.ruta,
    macroruta: row.macroruta,
    representante: row.representante,
    codigoNuec: row.codigo_nuec,
    adjuntos: row.adjuntos ?? [],
  };
}

@Injectable()
export class PrismaEcaRepository implements EcaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: PrismaArchivoRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(): Promise<Eca[]> {
    const rows = await this.prisma.eca.findMany({ include, orderBy: { id_eca: 'asc' } });
    return rows.map(ecaToDomain);
  }

  async findById(id: number): Promise<Eca | null> {
    const row = await this.prisma.eca.findUnique({ where: { id_eca: id }, include });
    return row ? ecaToDomain(row) : null;
  }

  async create(d: NuevaEca): Promise<Eca> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.eca.create({
        data: {
          nomEca: d.nombre,
          direccion: d.direccion,
          comuna: d.comuna,
          estado: d.estado,
          categoria: d.categoria,
          ruta: d.ruta,
          macroruta: d.macroruta,
          representante: d.representante,
          codigo_nuec: d.codigoNuec,
        },
        include,
      });
      for (const adjunto of d.adjuntos ?? []) await this.crearAdjunto(tx, row.id_eca, adjunto);
      const saved = await tx.eca.findUniqueOrThrow({ where: { id_eca: row.id_eca }, include });
      return ecaToDomain(saved);
    });
  }

  async update(id: number, c: CambiosEca): Promise<Eca> {
    return this.prisma.$transaction(async (tx) => {
      // Serializa reemplazos de adjuntos para mantener el límite incluso con ediciones concurrentes.
      await tx.$queryRaw`SELECT id_eca FROM ecas WHERE id_eca = ${id} FOR UPDATE`;
      if (c.adjuntos !== undefined) {
        const conservar = c.adjuntos.flatMap((a) => 'id' in a ? [a.id] : []);
        const existentes = await tx.ecaAdjunto.count({ where: { id_eca: id, id: { in: conservar } } });
        if (existentes !== conservar.length) {
          throw new ValidationError('Los adjuntos cambiaron durante la edición. Recarga la ECA e inténtalo de nuevo.');
        }
        const retirados = await tx.ecaAdjunto.findMany({ where: { id_eca: id, id: { notIn: conservar } }, select: { id: true } });
        await this.archivos.retirar(tx, ['eca'], retirados.map((doc) => doc.id));
        await tx.ecaAdjunto.deleteMany({ where: { id_eca: id, id: { notIn: conservar } } });
        for (const adjunto of c.adjuntos) {
          if (!('id' in adjunto)) await this.crearAdjunto(tx, id, adjunto);
        }
      }
      const row = await tx.eca.update({
        where: { id_eca: id },
        data: {
          nomEca: c.nombre,
          direccion: c.direccion,
          comuna: c.comuna,
          estado: c.estado,
          categoria: c.categoria,
          ruta: c.ruta,
          macroruta: c.macroruta,
          representante: c.representante,
          codigo_nuec: c.codigoNuec,
        },
        include,
      });
      return ecaToDomain(row);
    });
  }

  async findAdjunto(ecaId: number, adjuntoId: number) {
    const doc = await this.prisma.ecaAdjunto.findFirst({ where: { id: adjuntoId, id_eca: ecaId } });
    if (!doc) return null;
    if (this.storage.enabled || !doc.contenido) {
      const archivo = await this.prisma.archivoCarga.findFirst({ where: { uso: 'eca', vinculoId: doc.id, estado: 'VINCULADO' } });
      if (archivo) return { ...doc, contenido: await this.storage.read(archivo.clave, archivo.tamano) };
    }
    if (doc.contenido) return { ...doc, contenido: doc.contenido };
    throw new ValidationError('El adjunto no tiene un archivo asociado');
  }

  private async crearAdjunto(tx: Prisma.TransactionClient, ecaId: number, adjunto: Exclude<CambioAdjuntoEca, { id: number }>) {
    if ('archivo' in adjunto) {
      const file = await this.archivos.tomar(tx, adjunto.archivo, 'eca');
      const doc = await tx.ecaAdjunto.create({ data: { id_eca: ecaId, nombre: file.nombre, tamano: file.tamano, contenido: null } });
      await tx.archivoCarga.update({ where: { id: file.id }, data: { vinculoId: doc.id } });
    } else {
      await tx.ecaAdjunto.create({ data: { id_eca: ecaId, nombre: adjunto.nombre, tamano: adjunto.contenido.length, contenido: Buffer.from(adjunto.contenido) } });
    }
  }

  async hasRelations(id: number): Promise<boolean> {
    const [reporte, balance] = await Promise.all([
      this.prisma.reporte.findFirst({ where: { id_eca: id }, select: { consecutivo: true } }),
      this.prisma.balanceMensual.findFirst({ where: { id_eca: id }, select: { id: true } }),
    ]);
    return reporte !== null || balance !== null;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_eca FROM ecas WHERE id_eca = ${id} FOR UPDATE`;
      const docs = await tx.ecaAdjunto.findMany({ where: { id_eca: id }, select: { id: true } });
      await this.archivos.retirar(tx, ['eca'], docs.map((doc) => doc.id));
      await tx.eca.delete({ where: { id_eca: id } });
    });
  }
}
