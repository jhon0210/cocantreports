import { Eca } from '../../../domain/ecas/eca.entity';
import { EcaResponseDto } from '../dto/eca.dto';

export class EcaMapper {
  static toDto(e: Eca): EcaResponseDto {
    return {
      id_eca: e.id,
      nomEca: e.nombre,
      direccion: e.direccion,
      comuna: e.comuna,
      estado: e.estado,
      categoria: e.categoria,
      ruta: e.ruta,
      macroruta: e.macroruta,
      representante: e.representante,
      codigo_nuec: e.codigoNuec,
      adjuntos: e.adjuntos,
    };
  }
}
