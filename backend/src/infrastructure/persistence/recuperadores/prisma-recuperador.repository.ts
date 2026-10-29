import { Inject, Injectable } from '@nestjs/common';
import { Prisma, EstadoRecuperador as EstadoRow, Recuperador as RecuperadorRow } from '@prisma/client';
import { Caracterizacion } from '../../../domain/recuperadores/caracterizacion';
import { CambioDocumentoRecuperador, CambiosRecuperador, DocumentoRecuperador, NuevoRecuperador, Recuperador } from '../../../domain/recuperadores/recuperador.entity';
import { RecuperadorRepository } from '../../../domain/recuperadores/recuperador.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaArchivoRepository } from '../../storage/prisma-archivo.repository';
import { OBJECT_STORAGE, ObjectStorage } from '../../../application/ports/object-storage.port';
import { ConflictError, ValidationError } from '../../../domain/shared/domain-errors';

type Row = RecuperadorRow & { estado: EstadoRow; documentos: DocumentoRecuperador[] };

const include = { estado: true, documentos: { select: { id: true, tipo: true, nombre: true, mime: true, tamano: true } } } as const;

const toJson = (c: Caracterizacion | null | undefined): Prisma.InputJsonValue | undefined =>
  c ? (c as unknown as Prisma.InputJsonValue) : undefined;

function toDomain(row: Row, tieneFoto: boolean): Recuperador {
  return {
    id: row.id_recuperador,
    documentos: row.documentos,
    nombre: row.nombre,
    apellido: row.apellido,
    cedula: row.cedula,
    bancarizado: row.bancarizado,
    foto: row.foto,
    tieneFoto,
    codigoRegistro: row.codigo_registro,
    caracterizacion: row.caracterizacion as Caracterizacion | null,
    fechaRegistro: row.FechaRegistro,
    idEstado: row.id_estado,
    estado: { id: row.estado.id_estado, nombre: row.estado.nombre },
  };
}

@Injectable()
export class PrismaRecuperadorRepository implements RecuperadorRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: PrismaArchivoRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async detalle(row: Row): Promise<Recuperador> {
    const result = toDomain(row, row.foto !== null);
    if (row.foto && (this.storage.enabled || row.foto.startsWith('s3:'))) {
      const file = await this.prisma.archivoCarga.findFirst({ where: {
        ...(row.foto.startsWith('s3:') ? { id: row.foto.slice(3) } : {}),
        uso: 'foto', vinculoId: row.id_recuperador, estado: 'VINCULADO',
      } });
      if (file) result.foto = await this.storage.download(file.clave, file.nombre, file.mime);
      else if (row.foto.startsWith('s3:')) throw new ValidationError('La fotografia no tiene un archivo asociado');
    }
    return result;
  }

  async list(): Promise<Recuperador[]> {
    // No se descarga la foto en el listado: solo se consulta qué filas la tienen.
    const [rows, conFoto] = await Promise.all([
      this.prisma.recuperador.findMany({ omit: { foto: true }, include, orderBy: { id_recuperador: 'desc' } }),
      this.prisma.recuperador.findMany({ where: { foto: { not: null } }, select: { id_recuperador: true } }),
    ]);
    const ids = new Set(conFoto.map((r) => r.id_recuperador));
    return rows.map((r) => toDomain({ ...r, foto: null }, ids.has(r.id_recuperador)));
  }

  async findById(id: number): Promise<Recuperador | null> {
    const row = await this.prisma.recuperador.findUnique({ where: { id_recuperador: id }, include });
    return row ? this.detalle(row) : null;
  }

  async findByCedula(cedula: string): Promise<Recuperador | null> {
    const row = await this.prisma.recuperador.findUnique({ where: { cedula }, include });
    return row ? this.detalle(row) : null;
  }

  async findByCodigoRegistro(codigo: string): Promise<Recuperador | null> {
    const row = await this.prisma.recuperador.findUnique({ where: { codigo_registro: codigo }, include });
    return row ? this.detalle(row) : null;
  }

  async create(d: NuevoRecuperador): Promise<Recuperador> {
    const row = await this.prisma.$transaction(async (tx) => {
      const foto = d.fotoArchivo ? await this.archivos.tomar(tx, d.fotoArchivo, 'foto') : null;
      const created = await tx.recuperador.create({
        data: {
          nombre: d.nombre,
          apellido: d.apellido,
          cedula: d.cedula,
          id_estado: d.idEstado,
          bancarizado: d.bancarizado,
          foto: foto ? `s3:${foto.id}` : d.foto,
          codigo_registro: d.codigoRegistro,
          caracterizacion: toJson(d.caracterizacion),
        },
        include,
      });
      if (foto) await tx.archivoCarga.update({ where: { id: foto.id }, data: { vinculoId: created.id_recuperador } });
      for (const doc of d.documentos ?? []) if (!('id' in doc)) await this.crearDocumento(tx, created.id_recuperador, doc);
      return tx.recuperador.findUniqueOrThrow({ where: { id_recuperador: created.id_recuperador }, include });
    });
    return this.detalle(row);
  }

  async update(id: number, c: CambiosRecuperador): Promise<Recuperador> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_recuperador FROM recuperadores WHERE id_recuperador = ${id} FOR UPDATE`;
      const foto = c.fotoArchivo ? await this.archivos.tomar(tx, c.fotoArchivo, 'foto') : null;
      if (foto || c.foto !== undefined) await this.archivos.retirar(tx, ['foto'], [id]);
      if (c.documentos) {
        const conservar = c.documentos.flatMap((doc) => 'id' in doc ? [doc.id] : []);
        if (await tx.recuperadorDocumento.count({ where: { id_recuperador: id, id: { in: conservar } } }) !== conservar.length) {
          throw new ConflictError('Los documentos cambiaron durante la edicion; recarga el recuperador');
        }
        const retirados = await tx.recuperadorDocumento.findMany({ where: { id_recuperador: id, id: { notIn: conservar } }, select: { id: true } });
        await this.archivos.retirar(tx, ['identificacion', 'salud', 'servicios'], retirados.map((doc) => doc.id));
        await tx.recuperadorDocumento.deleteMany({ where: { id_recuperador: id, id: { notIn: conservar } } });
        for (const doc of c.documentos) if (!('id' in doc)) await this.crearDocumento(tx, id, doc);
      }
      if (foto) await tx.archivoCarga.update({ where: { id: foto.id }, data: { vinculoId: id } });
      return tx.recuperador.update({
        where: { id_recuperador: id },
        data: {
          nombre: c.nombre,
          apellido: c.apellido,
          cedula: c.cedula,
          id_estado: c.idEstado,
          bancarizado: c.bancarizado,
          foto: foto ? `s3:${foto.id}` : c.foto,
          codigo_registro: c.codigoRegistro,
          caracterizacion: toJson(c.caracterizacion),
        },
        include,
      });
    });
    return this.detalle(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_recuperador FROM recuperadores WHERE id_recuperador = ${id} FOR UPDATE`;
      const docs = await tx.recuperadorDocumento.findMany({ where: { id_recuperador: id }, select: { id: true } });
      await this.archivos.retirar(tx, ['identificacion', 'salud', 'servicios'], docs.map((doc) => doc.id));
      await this.archivos.retirar(tx, ['foto'], [id]);
      await tx.recuperador.delete({ where: { id_recuperador: id } });
    });
  }

  async hasReportes(id: number): Promise<boolean> {
    return (await this.prisma.reporte.count({ where: { id_recuperador: id }, take: 1 })) > 0;
  }

  async findDocumento(recuperadorId: number, documentoId: number) {
    const doc = await this.prisma.recuperadorDocumento.findFirst({
      where: { id: documentoId, id_recuperador: recuperadorId },
      select: { nombre: true, mime: true, contenido: true },
    });
    if (!doc) return null;
    if (this.storage.enabled || !doc.contenido) {
      const file = await this.prisma.archivoCarga.findFirst({ where: { vinculoId: documentoId, uso: { in: ['identificacion', 'salud', 'servicios'] }, estado: 'VINCULADO' } });
      if (file) return { ...doc, contenido: await this.storage.read(file.clave, file.tamano) };
    }
    if (doc.contenido) return { ...doc, contenido: doc.contenido };
    throw new ValidationError('El documento no tiene un archivo asociado');
  }

  private async crearDocumento(tx: Prisma.TransactionClient, recuperadorId: number, doc: Exclude<CambioDocumentoRecuperador, { id: number }>) {
    if ('archivo' in doc) {
      if (!['identificacion', 'salud', 'servicios'].includes(doc.tipo)) throw new ValidationError('Tipo de documento invalido');
      const uso = doc.tipo === 'salud' ? 'salud' : doc.tipo === 'servicios' ? 'servicios' : 'identificacion';
      const file = await this.archivos.tomar(tx, doc.archivo, uso);
      const created = await tx.recuperadorDocumento.create({ data: { id_recuperador: recuperadorId, tipo: doc.tipo, nombre: file.nombre, mime: file.mime, tamano: file.tamano, contenido: null } });
      await tx.archivoCarga.update({ where: { id: file.id }, data: { vinculoId: created.id } });
    } else {
      await tx.recuperadorDocumento.create({ data: { id_recuperador: recuperadorId, tipo: doc.tipo, nombre: doc.nombre, mime: doc.mime, tamano: doc.contenido.length, contenido: Buffer.from(doc.contenido) } });
    }
  }
}
