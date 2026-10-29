import { Injectable } from '@nestjs/common';
import { BalanceMensual, Prisma } from '@prisma/client';
import { CapturaBalance, FuenteBalance, gramos, GuardarBalance } from '../../../domain/balance-masas/balance.entity';
import { BalanceRepository } from '../../../domain/balance-masas/balance.repository';
import { ConflictError } from '../../../domain/shared/domain-errors';
import { formatDateOnly, parseDateOnly } from '../../../shared/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';

function fechas(periodo: string) {
  const desde = parseDateOnly(`${periodo}-01`)!;
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + 1);
  const anterior = new Date(desde);
  anterior.setUTCMonth(anterior.getUTCMonth() - 1);
  return { desde, hasta, anterior };
}

function toDomain(row: BalanceMensual): CapturaBalance {
  return {
    ...row, periodo: formatDateOnly(row.periodo).slice(0, 7),
    inventario_inicial_kg: Number(row.inventario_inicial_kg), salidas_kg: Number(row.salidas_kg),
    rechazos_kg: Number(row.rechazos_kg), entradas_cat_kg: row.entradas_cat_kg === null ? null : Number(row.entradas_cat_kg),
    entradas_al_guardar_kg: Number(row.entradas_al_guardar_kg), actualizado_en: row.actualizado_en.toISOString(),
  };
}

@Injectable()
export class PrismaBalanceRepository implements BalanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consultar(periodo: string, idEca?: number): Promise<FuenteBalance[]> {
    const { desde, hasta, anterior } = fechas(periodo);
    const entradaActual = this.prisma.reporte.groupBy({
      by: ['id_eca', 'id_mat'], orderBy: { id_eca: 'asc' }, where: { id_eca: idEca, FechaVenta: { gte: desde, lt: hasta } }, _sum: { cantidad: true },
    });
    const entradaAnterior = this.prisma.reporte.groupBy({
      by: ['id_eca', 'id_mat'], orderBy: { id_eca: 'asc' }, where: { id_eca: idEca, FechaVenta: { gte: anterior, lt: desde } }, _sum: { cantidad: true },
    });
    const [entradas, capturas, entradasPrevias, capturasPrevias, historicos] = await this.prisma.$transaction([
      entradaActual,
      this.prisma.balanceMensual.findMany({ where: { periodo: desde, id_eca: idEca } }),
      entradaAnterior,
      this.prisma.balanceMensual.findMany({ where: { periodo: anterior, id_eca: idEca } }),
      this.prisma.balanceMensual.findMany({
        where: { periodo: { lt: anterior }, id_eca: idEca }, distinct: ['id_eca', 'id_mat'], select: { id_eca: true, id_mat: true },
      }),
    ]);
    const key = (v: { id_eca: number; id_mat: number }) => `${v.id_eca}:${v.id_mat}`;
    const actuales = new Map(capturas.map((c) => [key(c), toDomain(c)]));
    const previas = new Map(capturasPrevias.map((c) => [key(c), toDomain(c)]));
    const pesos = new Map(entradas.map((e) => [key(e), gramos(e._sum.cantidad ?? 0) / 1000]));
    const pesosPrevios = new Map(entradasPrevias.map((e) => [key(e), gramos(e._sum.cantidad ?? 0) / 1000]));
    const claves = new Map([...entradas, ...capturas, ...capturasPrevias, ...historicos].map((e) => [key(e), { id_eca: e.id_eca, id_mat: e.id_mat }]));
    const [ecas, materiales] = await Promise.all([
      this.prisma.eca.findMany({ where: { id_eca: { in: [...new Set([...claves.values()].map((e) => e.id_eca))] } }, select: { id_eca: true, nomEca: true } }),
      this.prisma.material.findMany({ where: { id_mat: { in: [...new Set([...claves.values()].map((e) => e.id_mat))] } }, select: { id_mat: true, codigo: true, nomMaterial: true } }),
    ]);
    const nombresEca = new Map(ecas.map((e) => [e.id_eca, e.nomEca]));
    const nombresMaterial = new Map(materiales.map((m) => [m.id_mat, m]));
    return [...claves].map(([k, ids]) => {
      const previa = previas.get(k);
      return {
        ...ids, eca: nombresEca.get(ids.id_eca) ?? null, material: nombresMaterial.get(ids.id_mat)?.nomMaterial ?? null,
        codigo: nombresMaterial.get(ids.id_mat)?.codigo ?? null, entradas_kg: pesos.get(k) ?? 0,
        captura: actuales.get(k) ?? null,
        anterior: previa ? { entradas_kg: pesosPrevios.get(k) ?? 0, captura: previa } : null,
      };
    }).sort((a, b) => a.id_eca - b.id_eca || a.id_mat - b.id_mat);
  }

  async guardar(c: GuardarBalance): Promise<void> {
    const { desde, hasta } = fechas(c.periodo);
    const where = { periodo: desde, id_eca: c.id_eca, id_mat: c.id_mat };
    try {
      await this.prisma.$transaction(async (tx) => {
        const entradas = await tx.reporte.aggregate({ where: { id_eca: c.id_eca, id_mat: c.id_mat, FechaVenta: { gte: desde, lt: hasta } }, _sum: { cantidad: true } });
        if (gramos(entradas._sum.cantidad ?? 0) !== gramos(c.entradas_al_guardar_kg)) {
          throw new ConflictError('Las entradas cambiaron. Vuelve a consultar antes de guardar');
        }
        const data = {
          inventario_inicial_kg: c.inventario_inicial_kg.toFixed(3), salidas_kg: c.salidas_kg.toFixed(3),
          rechazos_kg: c.rechazos_kg.toFixed(3), entradas_cat_kg: c.entradas_cat_kg?.toFixed(3) ?? null,
          entradas_al_guardar_kg: c.entradas_al_guardar_kg.toFixed(3), soporte_salidas: c.soporte_salidas,
          receptor_rechazos: c.receptor_rechazos, observaciones: c.observaciones, id_user: c.id_user,
        };
        if (c.version === null) await tx.balanceMensual.create({ data: { ...where, ...data } });
        else {
          const result = await tx.balanceMensual.updateMany({ where: { ...where, version: c.version }, data: { ...data, version: { increment: 1 } } });
          if (result.count !== 1) throw new ConflictError('La captura cambió durante la edición. Vuelve a consultar');
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Ya existe una captura para ese periodo, ECA y material. Vuelve a consultar');
      }
      throw error;
    }
  }
}
