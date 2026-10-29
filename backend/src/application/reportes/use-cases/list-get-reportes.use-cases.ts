import { Inject, Injectable } from '@nestjs/common';
import { REPORTE_REPOSITORY, ReporteRepository } from '../../../domain/reportes/reporte.repository';
import { NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { parseDateOnly } from '../../../shared/utils/date.util';
import { RoleName } from '../../../shared/constants/roles';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { ListReportesQueryDto, ReporteResponseDto } from '../dto/reporte.dto';
import { ReporteMapper } from '../mappers/reporte.mapper';

/** Administrador y Coordinador ven todo; el Operario solo lo que él registró. */
function puedeVerTodos(actor: AuthenticatedUser): boolean {
  return actor.perfil === RoleName.ADMINISTRADOR || actor.perfil === RoleName.COORDINADOR;
}

@Injectable()
export class ListReportesUseCase {
  constructor(@Inject(REPORTE_REPOSITORY) private readonly reportes: ReporteRepository) {}

  async execute(actor: AuthenticatedUser, query: ListReportesQueryDto): Promise<ReporteResponseDto[]> {
    const date = (value?: string): Date | undefined => {
      if (value === undefined) return undefined;
      const parsed = parseDateOnly(value);
      if (!parsed) throw new ValidationError('La fecha de consulta no es válida');
      return parsed;
    };
    const ventaDesde = date(query.ventaDesde);
    const ventaHasta = date(query.ventaHasta);
    const registroDesde = date(query.registroDesde);
    const registroHasta = date(query.registroHasta);
    if ((ventaDesde && ventaHasta && ventaDesde > ventaHasta) || (registroDesde && registroHasta && registroDesde > registroHasta)) {
      throw new ValidationError('La fecha inicial no puede ser posterior a la final');
    }
    const lista = await this.reportes.list({
      idUser: puedeVerTodos(actor) ? undefined : actor.id,
      ventaDesde,
      ventaHasta,
      registroDesde,
      registroHasta,
      cedula: query.cedula,
      idEca: query.id_eca,
      idMat: query.id_mat,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
    return lista.map(ReporteMapper.toDto);
  }
}

@Injectable()
export class GetReporteUseCase {
  constructor(@Inject(REPORTE_REPOSITORY) private readonly reportes: ReporteRepository) {}

  async execute(actor: AuthenticatedUser, consecutivo: number): Promise<ReporteResponseDto> {
    const reporte = await this.reportes.findById(consecutivo);
    // Para un Operario, un reporte ajeno se trata como inexistente (no revela su existencia).
    if (!reporte || (!puedeVerTodos(actor) && reporte.idUser !== actor.id)) {
      throw new NotFoundError(`No existe el reporte ${consecutivo}`);
    }
    return ReporteMapper.toDto(reporte);
  }
}
