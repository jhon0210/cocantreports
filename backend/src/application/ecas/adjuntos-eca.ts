import { AdjuntoEca, CambioAdjuntoEca, NuevoAdjuntoEca } from '../../domain/ecas/eca.entity';
import { ValidationError } from '../../domain/shared/domain-errors';
import { EcaAdjuntoDto } from './dto/eca.dto';

export const MAX_PDF_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_COUNT = 5;

export function validarPdf(dto: EcaAdjuntoDto): Extract<NuevoAdjuntoEca, { contenido: Uint8Array }> {
  if (typeof dto.nombre !== 'string' || !/^[^\\/\x00-\x1f\x7f]{1,150}\.pdf$/i.test(dto.nombre) || dto.nombre.length > 150) {
    throw new ValidationError('El adjunto debe tener un nombre válido con extensión .pdf (máximo 150 caracteres)');
  }
  if (typeof dto.contenido !== 'string' || dto.contenido.length > 2_796_204) {
    throw new ValidationError('El contenido del PDF no es válido');
  }
  const contenido = Buffer.from(dto.contenido, 'base64');
  if (contenido.toString('base64') !== dto.contenido) {
    throw new ValidationError('El contenido del PDF no es válido');
  }
  if (contenido.length > MAX_PDF_BYTES || contenido.length < 8 || !contenido.subarray(0, 8).toString('ascii').match(/^%PDF-\d\.\d/) || !contenido.subarray(-1024).includes(Buffer.from('%%EOF'))) {
    throw new ValidationError('Solo se admiten archivos PDF de hasta 2 MB');
  }
  return { nombre: dto.nombre, contenido };
}

export function prepararAdjuntos(dtos: EcaAdjuntoDto[], actuales: AdjuntoEca[] = [], propietarioId?: number): CambioAdjuntoEca[] {
  if (dtos.length > MAX_PDF_COUNT) throw new ValidationError('Solo puedes adjuntar hasta 5 archivos PDF por ECA');
  const usados = new Set<number>();
  return dtos.map((dto) => {
    if (dto.id !== undefined) {
      if (!actuales.some((a) => a.id === dto.id) || usados.has(dto.id) || dto.contenido !== undefined || dto.nombre !== undefined || dto.archivo_id !== undefined) {
        throw new ValidationError('La referencia al adjunto no es válida para esta ECA');
      }
      usados.add(dto.id);
      return { id: dto.id };
    }
    if (dto.archivo_id !== undefined) {
      if (!dto.archivo_id || !propietarioId || dto.contenido !== undefined || dto.nombre !== undefined) {
        throw new ValidationError('Referencia S3 invalida');
      }
      return { archivo: { id: dto.archivo_id, propietarioId } };
    }
    if (process.env.FILE_STORAGE === 's3') throw new ValidationError('Adjunta los archivos mediante la carga directa S3');
    return validarPdf(dto);
  });
}
