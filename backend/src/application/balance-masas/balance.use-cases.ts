import { Inject, Injectable } from '@nestjs/common';
import { BALANCE_REPOSITORY, BalanceRepository } from '../../domain/balance-masas/balance.repository';
import { gramos, ResumenBalance, resumirBalance, validarCapturaBalance } from '../../domain/balance-masas/balance.entity';
import { ECA_REPOSITORY, EcaRepository } from '../../domain/ecas/eca.repository';
import { MATERIAL_REPOSITORY, MaterialRepository } from '../../domain/materiales/material.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/shared/domain-errors';
import { parseDateOnly } from '../../shared/utils/date.util';
import { CLOCK, Clock } from '../ports/clock.port';
import { ConsultaBalanceDto, GuardarBalanceDto } from './balance.dto';

@Injectable()
export class BalanceMasasUseCases {
  constructor(
    @Inject(BALANCE_REPOSITORY) private readonly balances: BalanceRepository,
    @Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository,
    @Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private validarPeriodo(periodo: string): void {
    const fecha = parseDateOnly(`${periodo}-01`);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) || !fecha || fecha > this.clock.today()) {
      throw new ValidationError('El periodo debe ser un mes válido, no futuro');
    }
  }

  async consultar(dto: ConsultaBalanceDto): Promise<ResumenBalance[]> {
    this.validarPeriodo(dto.periodo);
    return (await this.balances.consultar(dto.periodo, dto.id_eca)).map(resumirBalance);
  }

  async guardar(dto: GuardarBalanceDto, idUser: number): Promise<void> {
    this.validarPeriodo(dto.periodo);
    if (dto.mediciones_confirmadas !== true) throw new ValidationError('Confirma que las cantidades están medidas y soportadas');
    const [eca, material] = await Promise.all([this.ecas.findById(dto.id_eca), this.materiales.findById(dto.id_mat)]);
    if (!eca) throw new NotFoundError('La ECA no existe');
    if (!material) throw new NotFoundError('El material no existe');
    const filas = await this.balances.consultar(dto.periodo, dto.id_eca);
    const fuente = filas.find((f) => f.id_mat === dto.id_mat) ?? {
      id_eca: dto.id_eca, id_mat: dto.id_mat, eca: eca.nombre, material: material.nombre,
      codigo: material.codigo, entradas_kg: 0, captura: null, anterior: null,
    };
    if (gramos(dto.entradas_esperadas_kg) !== gramos(fuente.entradas_kg)) {
      throw new ConflictError('Las entradas cambiaron. Vuelve a consultar antes de guardar');
    }
    const captura = {
      periodo: dto.periodo, id_eca: dto.id_eca, id_mat: dto.id_mat,
      inventario_inicial_kg: dto.inventario_inicial_kg, salidas_kg: dto.salidas_kg, rechazos_kg: dto.rechazos_kg,
      entradas_cat_kg: dto.entradas_cat_kg ?? null, entradas_al_guardar_kg: fuente.entradas_kg,
      soporte_salidas: dto.soporte_salidas?.trim() || null, receptor_rechazos: dto.receptor_rechazos?.trim() || null,
      observaciones: dto.observaciones?.trim() || null, id_user: idUser, version: dto.version,
    };
    validarCapturaBalance(captura, fuente);
    await this.balances.guardar(captura);
  }
}
