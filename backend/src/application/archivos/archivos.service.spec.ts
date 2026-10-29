import { createHash } from 'node:crypto';
import { ArchivosService } from './archivos.service';
import { ArchivoCarga, ArchivoRepository } from '../../domain/archivos/archivo';
import { ObjectStorage } from '../ports/object-storage.port';
import { ConflictError, ForbiddenError, ValidationError } from '../../domain/shared/domain-errors';

describe('ArchivosService', () => {
  const pdf = Buffer.from('%PDF-1.7\nsynthetic\n%%EOF');
  let repository: jest.Mocked<ArchivoRepository>;
  let storage: jest.Mocked<ObjectStorage>;
  let service: ArchivosService;
  let archivo: ArchivoCarga;

  beforeEach(() => {
    repository = {
      create: jest.fn(), find: jest.fn(), ready: jest.fn().mockResolvedValue(true),
      expired: jest.fn().mockResolvedValue([]), deleting: jest.fn().mockResolvedValue(true), remove: jest.fn(),
    };
    storage = {
      enabled: true, authorize: jest.fn().mockResolvedValue({ url: 'https://storage.example.test', fields: {} }),
      read: jest.fn().mockResolvedValue(pdf), writeOnce: jest.fn(), download: jest.fn(), remove: jest.fn(),
    };
    service = new ArchivosService(storage, repository);
    archivo = {
      id: '00000000-0000-4000-8000-000000000001', propietarioId: 1, uso: 'eca', nombre: 'synthetic.pdf',
      mime: 'application/pdf', tamano: pdf.length, sha256: createHash('sha256').update(pdf).digest('base64'),
      claveTemporal: 'pendientes/synthetic', clave: 'archivos/synthetic',
      estado: 'PENDIENTE', vinculoId: null, creadoEn: new Date(), expiraEn: new Date(Date.now() + 60_000),
    };
    repository.find.mockResolvedValue(archivo);
  });

  it('autoriza una clave opaca con vigencia limitada y metadatos sin bytes', async () => {
    const result = await service.authorize({ uso: 'eca', nombre: archivo.nombre, mime: archivo.mime, tamano: archivo.tamano, sha256: archivo.sha256 }, 1);
    expect(result.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ propietarioId: 1, estado: 'PENDIENTE', nombre: archivo.nombre }));
    expect(storage.authorize).toHaveBeenCalledWith(`pendientes/${result.id}`, archivo.mime, archivo.tamano, archivo.sha256);
  });

  it('rechaza tipos y tamanos incompatibles antes de firmar', async () => {
    await expect(service.authorize({ uso: 'foto', nombre: 'a.pdf', mime: 'application/pdf', tamano: pdf.length, sha256: archivo.sha256 }, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.authorize({ uso: 'salud', nombre: 'a.pdf', mime: 'application/pdf', tamano: 1024 * 1024 + 1, sha256: archivo.sha256 }, 1)).rejects.toBeInstanceOf(ValidationError);
    expect(storage.authorize).not.toHaveBeenCalled();
  });

  it('rechaza confirmaciones ajenas, expiradas y ya vinculadas', async () => {
    await expect(service.confirm(archivo.id, 2)).rejects.toBeInstanceOf(ForbiddenError);
    archivo.expiraEn = new Date(0);
    await expect(service.confirm(archivo.id, 1)).rejects.toBeInstanceOf(ConflictError);
    archivo.expiraEn = new Date(Date.now() + 60_000);
    archivo.estado = 'VINCULADO';
    await expect(service.confirm(archivo.id, 1)).rejects.toBeInstanceOf(ConflictError);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('verifica checksum y firma real antes de escribir', async () => {
    storage.read.mockResolvedValue(Buffer.alloc(pdf.length));
    await expect(service.confirm(archivo.id, 1)).rejects.toBeInstanceOf(ValidationError);
    archivo.sha256 = createHash('sha256').update(Buffer.alloc(pdf.length)).digest('base64');
    await expect(service.confirm(archivo.id, 1)).rejects.toBeInstanceOf(ValidationError);
    expect(storage.writeOnce).not.toHaveBeenCalled();
    expect(repository.ready).not.toHaveBeenCalled();
  });

  it('publica un objeto inmutable y elimina el temporal despues de validar', async () => {
    expect(await service.confirm(archivo.id, 1)).toEqual({ id: archivo.id });
    expect(storage.writeOnce).toHaveBeenCalledWith(archivo.clave, pdf, archivo.mime, archivo.sha256);
    expect(repository.ready).toHaveBeenCalledWith(archivo.id, 1);
    expect(storage.remove).toHaveBeenCalledWith(archivo.claveTemporal);
  });

  it('permite reintentar la confirmacion sin reescribir el objeto final', async () => {
    archivo.estado = 'LISTO';
    await service.confirm(archivo.id, 1);
    expect(storage.read).not.toHaveBeenCalled();
    expect(storage.writeOnce).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith(archivo.claveTemporal);
  });

  it('propaga errores de almacenamiento y no declara exito si cambia la carga', async () => {
    storage.writeOnce.mockRejectedValueOnce(new Error('S3 unavailable'));
    await expect(service.confirm(archivo.id, 1)).rejects.toThrow('S3 unavailable');
    expect(repository.ready).not.toHaveBeenCalled();
    repository.ready.mockResolvedValue(false);
    await expect(service.confirm(archivo.id, 1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('solo elimina cargas reclamadas por la limpieza y conserva metadatos ante fallos', async () => {
    repository.expired.mockResolvedValue([archivo]);
    repository.deleting.mockResolvedValueOnce(false);
    expect(await service.cleanup()).toEqual({ eliminados: 0, limite: 100 });
    expect(storage.remove).not.toHaveBeenCalled();
    storage.remove.mockRejectedValueOnce(new Error('delete unavailable'));
    await expect(service.cleanup()).rejects.toThrow('delete unavailable');
    expect(repository.remove).not.toHaveBeenCalled();
    expect(await service.cleanup()).toEqual({ eliminados: 1, limite: 100 });
    expect(repository.remove).toHaveBeenCalledWith(archivo.id);
  });
});
