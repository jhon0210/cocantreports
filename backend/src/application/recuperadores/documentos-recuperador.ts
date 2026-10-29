import { CambioDocumentoRecuperador, DocumentoRecuperador } from '../../domain/recuperadores/recuperador.entity';
import { ValidationError } from '../../domain/shared/domain-errors';
import { DocumentoRecuperadorDto } from './dto/recuperador.dto';

export function mimeDocumento(nombre: string, contenido: Buffer): string {
  if (/\.pdf$/i.test(nombre) && /^%PDF-\d\.\d/.test(contenido.subarray(0, 8).toString('ascii')) && contenido.subarray(-1024).includes(Buffer.from('%%EOF'))) {
    return 'application/pdf';
  }
  if (/\.png$/i.test(nombre) && contenido.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (/\.jpe?g$/i.test(nombre) && contenido.length > 4 && contenido[0] === 255 && contenido[1] === 216 && contenido[2] === 255 && contenido[contenido.length - 2] === 255 && contenido[contenido.length - 1] === 217) return 'image/jpeg';
  throw new ValidationError('Solo se admiten archivos PDF, PNG o JPEG validos');
}

export function prepararDocumentos(dtos: DocumentoRecuperadorDto[], actuales: DocumentoRecuperador[] = [], propietarioId?: number): CambioDocumentoRecuperador[] {
  if (!Array.isArray(dtos) || dtos.length > 3) throw new ValidationError('Solo se admite un documento de cada tipo: identificación, salud y servicios');
  const tipos = new Set<string>();
  return dtos.map((dto) => {
    if (dto.id !== undefined) {
      const actual = actuales.find((d) => d.id === dto.id);
      if (!actual || tipos.has(actual.tipo) || dto.tipo !== undefined || dto.nombre !== undefined || dto.contenido !== undefined || dto.archivo_id !== undefined) {
        throw new ValidationError('El documento no pertenece al recuperador o está repetido');
      }
      tipos.add(actual.tipo);
      return { id: dto.id };
    }
    if (!dto.tipo || !['identificacion', 'salud', 'servicios'].includes(dto.tipo) || tipos.has(dto.tipo)) {
      throw new ValidationError('El tipo de documento no es válido o está repetido');
    }
    tipos.add(dto.tipo);
    if (dto.archivo_id !== undefined) {
      if (!dto.archivo_id || !propietarioId || dto.contenido !== undefined || dto.nombre !== undefined) throw new ValidationError('Referencia S3 invalida');
      return { tipo: dto.tipo, archivo: { id: dto.archivo_id, propietarioId } };
    }
    if (!dto.nombre || !/^[^\\/\x00-\x1f\x7f]{1,150}$/.test(dto.nombre) || !dto.contenido || dto.contenido.length > 1_398_104) {
      throw new ValidationError('El nombre o contenido del documento no es válido');
    }
    const contenido = Buffer.from(dto.contenido, 'base64');
    if (contenido.length > 1024 * 1024 || contenido.toString('base64') !== dto.contenido) {
      throw new ValidationError('El documento debe tener hasta 1 MB y una codificación válida');
    }
    const mime = mimeDocumento(dto.nombre, contenido);
    return { tipo: dto.tipo, nombre: dto.nombre, mime, contenido };
  });
}
