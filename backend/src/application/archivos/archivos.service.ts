import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { ARCHIVO_REPOSITORY, ArchivoRepository, ArchivoCarga } from '../../domain/archivos/archivo';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/shared/domain-errors';
import { OBJECT_STORAGE, ObjectStorage } from '../ports/object-storage.port';
import { validarPdf } from '../ecas/adjuntos-eca';
import { mimeDocumento } from '../recuperadores/documentos-recuperador';
import { AutorizarArchivoDto } from './archivo.dto';

@Injectable()
export class ArchivosService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ARCHIVO_REPOSITORY) private readonly repository: ArchivoRepository,
  ) {}

  config() {
    return { almacenamiento: this.storage.enabled ? 's3' : 'bd' };
  }

  async authorize(dto: AutorizarArchivoDto, propietarioId: number) {
    if (!this.storage.enabled) throw new ConflictError('El almacenamiento S3 no esta habilitado');
    const max = dto.uso === 'eca' ? 2 * 1024 * 1024 : dto.uso === 'foto' ? 1_125_000 : 1024 * 1024;
    if (dto.tamano > max || (dto.uso === 'eca' && dto.mime !== 'application/pdf') ||
      (dto.uso === 'foto' && !dto.mime.startsWith('image/'))) {
      throw new ValidationError('Tipo o tamano no permitido para este archivo');
    }
    if ((dto.mime === 'application/pdf' && !/\.pdf$/i.test(dto.nombre)) ||
      (dto.mime === 'image/png' && !/\.png$/i.test(dto.nombre)) ||
      (dto.mime === 'image/jpeg' && !/\.jpe?g$/i.test(dto.nombre))) {
      throw new ValidationError('La extension no corresponde al tipo de archivo');
    }
    const id = randomUUID();
    const now = new Date();
    const archivo: ArchivoCarga = {
      ...dto, id, propietarioId, claveTemporal: `pendientes/${id}`, clave: `archivos/${id}`,
      estado: 'PENDIENTE', vinculoId: null, creadoEn: now,
      expiraEn: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
    const form = await this.storage.authorize(archivo.claveTemporal, dto.mime, dto.tamano, dto.sha256);
    await this.repository.create(archivo);
    return { id, ...form, expira_en: new Date(now.getTime() + 5 * 60 * 1000).toISOString() };
  }

  async confirm(id: string, propietarioId: number) {
    const archivo = await this.repository.find(id);
    if (!archivo) throw new NotFoundError('No existe la carga');
    if (archivo.propietarioId !== propietarioId) throw new ForbiddenError('La carga pertenece a otro usuario');
    if (archivo.expiraEn <= new Date()) throw new ConflictError('La carga expiro; vuelve a adjuntar el archivo');
    if (archivo.estado === 'LISTO') {
      await this.storage.remove(archivo.claveTemporal);
      return { id };
    }
    if (archivo.estado !== 'PENDIENTE') throw new ConflictError('La carga no se puede confirmar');
    const bytes = Buffer.from(await this.storage.read(archivo.claveTemporal, archivo.tamano));
    if (bytes.length !== archivo.tamano || createHash('sha256').update(bytes).digest('base64') !== archivo.sha256) {
      throw new ValidationError('El tamano o checksum del archivo no coincide');
    }
    const contenido = bytes.toString('base64');
    if (archivo.uso === 'eca') validarPdf({ nombre: archivo.nombre, contenido });
    else {
      const mime = mimeDocumento(archivo.nombre, bytes);
      if (mime !== archivo.mime || (archivo.uso === 'foto' && !mime.startsWith('image/'))) {
        throw new ValidationError('El contenido no coincide con el tipo declarado');
      }
    }
    await this.storage.writeOnce(archivo.clave, bytes, archivo.mime, archivo.sha256);
    if (!await this.repository.ready(id, propietarioId)) throw new ConflictError('La carga cambio o expiro durante la validacion');
    await this.storage.remove(archivo.claveTemporal);
    return { id };
  }

  async cleanup() {
    if (!this.storage.enabled) throw new ConflictError('S3 no habilitado');
    let eliminados = 0;
    for (const archivo of await this.repository.expired(100)) {
      if (!await this.repository.deleting(archivo.id)) continue;
      await this.storage.remove(archivo.claveTemporal);
      await this.storage.remove(archivo.clave);
      await this.repository.remove(archivo.id);
      eliminados++;
    }
    return { eliminados, limite: 100 };
  }
}
