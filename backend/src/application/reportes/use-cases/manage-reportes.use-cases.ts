import { Inject, Injectable } from '@nestjs/common';
import { MATERIAL_REPOSITORY, MaterialRepository } from '../../../domain/materiales/material.repository';
import { ECA_REPOSITORY, EcaRepository } from '../../../domain/ecas/eca.repository';
import { CambiosReporte, validarImportesVenta } from '../../../domain/reportes/reporte.entity';
import { REPORTE_REPOSITORY, ReporteRepository } from '../../../domain/reportes/reporte.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { RoleName } from '../../../shared/constants/roles';
import { parseDateOnly } from '../../../shared/utils/date.util';
import { CLOCK, Clock } from '../../ports/clock.port';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { ReporteResponseDto, UpdateReporteDto } from '../dto/reporte.dto';
import { ReporteMapper } from '../mappers/reporte.mapper';

@Injectable()
export class ManageReportesUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY) private readonly reportes: ReporteRepository,
    @Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository,
    @Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.perfil !== RoleName.ADMINISTRADOR) throw new ForbiddenError('Solo un Administrador puede eliminar reportes guardados');
  }

  async update(actor: AuthenticatedUser, id: number, dto: UpdateReporteDto): Promise<ReporteResponseDto> {
    if (actor.perfil !== RoleName.ADMINISTRADOR && actor.perfil !== RoleName.COORDINADOR) {
      throw new ForbiddenError('Solo un Administrador o Coordinador puede editar reportes guardados');
    }
    const original = await this.reportes.findById(id);
    if (!original) throw new NotFoundError(`No existe el reporte ${id}`);
    if (!(await this.materiales.findById(dto.id_mat))) throw new NotFoundError(`No existe el material ${dto.id_mat}`);
    if (!(await this.ecas.findById(dto.id_eca))) throw new NotFoundError(`No existe la ECA ${dto.id_eca}`);
    const fechaVenta = dto.FechaVenta === undefined ? original.fechaVenta : parseDateOnly(dto.FechaVenta);
    if (!fechaVenta || fechaVenta > this.clock.today()) throw new ValidationError('La fecha de venta no es válida o es futura');
    validarImportesVenta(dto.cantidad, dto.valor);
    if (dto.id_eca_macroruta != null) {
      const macro = await this.ecas.findById(dto.id_eca_macroruta);
      if (!macro?.macroruta) throw new ValidationError('La macroruta seleccionada no está disponible');
    }
    const data: CambiosReporte = {
      idMat: dto.id_mat,
      cantidad: dto.cantidad,
      valor: dto.valor,
      idEca: dto.id_eca,
      idEcaMacroruta: dto.id_eca_macroruta,
      fechaVenta,
    };
    return ReporteMapper.toDto(await this.reportes.update(id, data));
  }

  async remove(actor: AuthenticatedUser, id: number): Promise<void> {
    this.requireAdmin(actor);
    if (!(await this.reportes.findById(id))) throw new NotFoundError(`No existe el reporte ${id}`);
    await this.reportes.delete(id);
  }

  async comprobante(actor: AuthenticatedUser, id: number): Promise<ReporteResponseDto[]> {
    const rows = await this.reportes.findComprobante(id);
    if (!rows.length || (actor.perfil !== RoleName.ADMINISTRADOR && actor.perfil !== RoleName.COORDINADOR && rows.some((r) => r.idUser !== actor.id))) {
      throw new NotFoundError(`No existe el reporte ${id}`);
    }
    return rows.map(ReporteMapper.toDto);
  }
}
