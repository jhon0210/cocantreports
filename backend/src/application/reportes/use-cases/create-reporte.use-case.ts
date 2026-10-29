import { Inject, Injectable } from '@nestjs/common';
import { MATERIAL_REPOSITORY, MaterialRepository } from '../../../domain/materiales/material.repository';
import { EstadoRecuperadorId } from '../../../domain/recuperadores/estado-recuperador.entity';
import { RECUPERADOR_REPOSITORY, RecuperadorRepository } from '../../../domain/recuperadores/recuperador.repository';
import { NuevoReporte } from '../../../domain/reportes/reporte.entity';
import { REPORTE_REPOSITORY, ReporteRepository } from '../../../domain/reportes/reporte.repository';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { ECA_REPOSITORY, EcaRepository } from '../../../domain/ecas/eca.repository';
import { RoleName } from '../../../shared/constants/roles';
import { parseDateOnly } from '../../../shared/utils/date.util';
import { CLOCK, Clock } from '../../ports/clock.port';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { CreateReporteDto, ReporteResponseDto } from '../dto/reporte.dto';
import { ReporteMapper } from '../mappers/reporte.mapper';

@Injectable()
export class CreateReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY) private readonly reportes: ReporteRepository,
    @Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository,
    @Inject(RECUPERADOR_REPOSITORY) private readonly recuperadores: RecuperadorRepository,
    @Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(actor: AuthenticatedUser, dto: CreateReporteDto): Promise<ReporteResponseDto> {
    return ReporteMapper.toDto(await this.reportes.create(await this.prepare(actor, dto)));
  }

  async executeBatch(actor: AuthenticatedUser, registros: CreateReporteDto[]): Promise<ReporteResponseDto[]> {
    if (!registros.length) throw new ValidationError('Agrega al menos un registro');
    const nuevos: NuevoReporte[] = [];
    for (const dto of registros) nuevos.push(await this.prepare(actor, dto));
    return (await this.reportes.createBatch(nuevos)).map(ReporteMapper.toDto);
  }

  private async prepare(actor: AuthenticatedUser, dto: CreateReporteDto): Promise<NuevoReporte> {
    if (actor.perfil === RoleName.ADMINISTRADOR_ECA) {
      if (actor.idEca === null) throw new BusinessRuleError('Tu cuenta no tiene una ECA asociada. Solicita su asignación a un Administrador.');
      if (dto.id_eca !== actor.idEca) throw new ForbiddenError('Solo puedes registrar ventas en tu ECA asociada');
    }
    const recuperador = await this.recuperadores.findById(dto.id_recuperador);
    if (!recuperador) throw new NotFoundError(`No existe el recuperador ${dto.id_recuperador}`);
    if (recuperador.idEstado !== EstadoRecuperadorId.ACTIVO) {
      throw new BusinessRuleError(`El recuperador está en estado ${recuperador.estado.nombre} y no puede registrar ventas`);
    }

    if (!(await this.materiales.findById(dto.id_mat))) throw new NotFoundError(`No existe el material ${dto.id_mat}`);
    if (!(await this.ecas.findById(dto.id_eca))) throw new NotFoundError(`No existe la ECA ${dto.id_eca}`);
    if (dto.id_eca_macroruta != null) {
      const macro = await this.ecas.findById(dto.id_eca_macroruta);
      if (!macro?.macroruta) throw new ValidationError('La macroruta seleccionada no está disponible');
    }
    const hoy = this.clock.today();
    let fechaVenta = hoy;
    if (dto.FechaVenta !== undefined) {
      const parsed = parseDateOnly(dto.FechaVenta);
      if (!parsed) throw new ValidationError('FechaVenta no es una fecha válida');
      if (parsed.getTime() > hoy.getTime()) throw new ValidationError('La fecha de venta no puede ser futura');
      fechaVenta = parsed;
    }

    return NuevoReporte.crear({
      idMat: dto.id_mat,
      cantidad: dto.cantidad,
      valor: dto.valor,
      idUser: actor.id,
      idEca: dto.id_eca,
      idEcaMacroruta: dto.id_eca_macroruta,
      idRecuperador: recuperador.id,
      fechaRegistro: hoy,
      fechaVenta,
    });
  }
}
