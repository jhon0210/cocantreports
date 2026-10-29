import { Recuperador } from '../../../domain/recuperadores/recuperador.entity';
import { formatDateOnly } from '../../../shared/utils/date.util';
import { EcaMapper } from '../../ecas/mappers/eca.mapper';
import { RecuperadorResponseDto } from '../dto/recuperador.dto';

export class RecuperadorMapper {
  static toDto(r: Recuperador): RecuperadorResponseDto {
    return {
      id_recuperador: r.id,
      documentos: r.documentos ?? [],
      nombre: r.nombre,
      apellido: r.apellido,
      cedula: r.cedula,
      bancarizado: r.bancarizado,
      foto: r.foto,
      tiene_foto: r.tieneFoto,
      codigo_registro: r.codigoRegistro,
      caracterizacion: r.caracterizacion,
      FechaRegistro: formatDateOnly(r.fechaRegistro),
      id_estado: r.idEstado,
      estado: r.estado.nombre,
    };
  }
}
