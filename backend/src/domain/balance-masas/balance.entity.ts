import { ValidationError } from '../shared/domain-errors';

export interface CapturaBalance {
  periodo: string;
  id_eca: number;
  id_mat: number;
  inventario_inicial_kg: number;
  salidas_kg: number;
  rechazos_kg: number;
  entradas_cat_kg: number | null;
  entradas_al_guardar_kg: number;
  soporte_salidas: string | null;
  receptor_rechazos: string | null;
  observaciones: string | null;
  id_user: number;
  version: number;
  actualizado_en: string;
}

export type GuardarBalance = Omit<CapturaBalance, 'actualizado_en' | 'version'> & { version: number | null };

export interface FuenteBalance {
  id_eca: number;
  id_mat: number;
  eca: string | null;
  material: string | null;
  codigo: number | null;
  entradas_kg: number;
  captura: CapturaBalance | null;
  anterior: { entradas_kg: number; captura: CapturaBalance } | null;
}

export interface ResumenBalance extends FuenteBalance {
  inventario_anterior_kg: number | null;
  inventario_final_kg: number | null;
  novedades: string[];
}

export function gramos(kg: number): number {
  const valor = Math.round(kg * 1000);
  if (!Number.isFinite(kg) || kg < 0 || !Number.isSafeInteger(valor) || Math.abs(kg * 1000 - valor) > 0.01) {
    throw new ValidationError('La cantidad debe ser no negativa y tener hasta tres decimales en kg');
  }
  return valor;
}

function saldo(captura: CapturaBalance, entradas: number): number {
  return (gramos(captura.inventario_inicial_kg) + gramos(entradas) - gramos(captura.salidas_kg) - gramos(captura.rechazos_kg)) / 1000;
}

export function resumirBalance(fuente: FuenteBalance): ResumenBalance {
  const { captura, anterior, entradas_kg } = fuente;
  const novedades: string[] = [];
  const inventario_anterior_kg = anterior ? saldo(anterior.captura, anterior.entradas_kg) : null;
  const inventario_final_kg = captura ? saldo(captura, entradas_kg) : null;
  if (!captura) novedades.push('Falta registrar inventario inicial, salidas y rechazos del mes');
  if (!anterior) novedades.push('Sin captura del mes anterior: inventario inicial declarado, no conciliado con ese periodo');
  if (anterior && gramos(anterior.entradas_kg) !== gramos(anterior.captura.entradas_al_guardar_kg)) {
    novedades.push('Cambiaron las entradas del mes anterior; revisar su captura antes de conciliar');
  }
  if (inventario_anterior_kg !== null && inventario_anterior_kg < 0) novedades.push('El saldo del mes anterior es negativo');
  if (captura) {
    if (gramos(captura.entradas_al_guardar_kg) !== gramos(entradas_kg)) novedades.push('Las entradas cambiaron desde la captura; revisar y volver a guardar');
    if (inventario_final_kg !== null && inventario_final_kg < 0) novedades.push('Inventario final negativo: revisar entradas, salidas y rechazos');
    if (inventario_anterior_kg !== null && captura.inventario_inicial_kg !== inventario_anterior_kg) novedades.push('El inventario inicial no coincide con el saldo del mes anterior');
    if (captura.entradas_cat_kg === null) novedades.push('Procedencia CAT pendiente de discriminar');
    else if (gramos(captura.entradas_cat_kg) > gramos(entradas_kg)) novedades.push('Las entradas CAT superan las entradas del mes');
  }
  return { ...fuente, inventario_anterior_kg, inventario_final_kg, novedades };
}

export function validarCapturaBalance(captura: GuardarBalance, fuente: FuenteBalance): void {
  const inicial = gramos(captura.inventario_inicial_kg);
  const entradas = gramos(fuente.entradas_kg);
  const salidas = gramos(captura.salidas_kg);
  const rechazos = gramos(captura.rechazos_kg);
  if (inicial + entradas < salidas + rechazos) throw new ValidationError('Las salidas y rechazos superan el inventario inicial más las entradas');
  if (captura.entradas_cat_kg !== null && gramos(captura.entradas_cat_kg) > entradas) throw new ValidationError('La cantidad procedente de CAT no puede superar las entradas');
  if (salidas > 0 && !captura.soporte_salidas?.trim()) throw new ValidationError('Indica compradores y referencias de facturas de las salidas efectivas');
  if (rechazos > 0 && !captura.receptor_rechazos?.trim()) throw new ValidationError('Indica el prestador que recibió los rechazos y la referencia de entrega');
  const previo = resumirBalance(fuente);
  if (fuente.anterior) {
    if (gramos(fuente.anterior.entradas_kg) !== gramos(fuente.anterior.captura.entradas_al_guardar_kg)) {
      throw new ValidationError('Revisa y guarda primero el balance del mes anterior: sus entradas cambiaron');
    }
    if (previo.inventario_anterior_kg !== captura.inventario_inicial_kg) throw new ValidationError('El inventario inicial debe coincidir con el saldo del mes anterior');
  }
}
