import { Reporte } from '../../../domain/reportes/reporte.entity';
import { formatDateOnly } from '../../../shared/utils/date.util';
import { ReporteResponseDto } from '../dto/reporte.dto';

export class ReporteMapper {
  static toDto(r: Reporte): ReporteResponseDto {
    return {
      consecutivo: r.consecutivo,
      comprobante: r.comprobante ?? null,
      numero_reporte: r.numeroReporte,
      id_mat: r.idMat,
      material: { codigo: r.material.codigo, nomMaterial: r.material.nombre },
      cantidad: r.cantidad,
      valor: r.valor,
      subtotal: r.subtotal,
      id_user: r.idUser,
      usuario: { nomUser: r.usuario.nombre, apeUser: r.usuario.apellido, usuario: r.usuario.usuario },
      id_eca: r.idEca,
      id_eca_macroruta: r.idEcaMacroruta ?? null,
      macroruta: r.macroruta ?? null,
      eca: { nomEca: r.eca.nombre, direccion: r.eca.direccion, comuna: r.eca.comuna, codigo_nuec: r.eca.codigo_nuec ?? null },
      id_recuperador: r.idRecuperador,
      recuperador: r.recuperador,
      FechaRegistro: formatDateOnly(r.fechaRegistro),
      FechaVenta: formatDateOnly(r.fechaVenta),
    };
  }
}
