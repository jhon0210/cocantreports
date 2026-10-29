import { ValidationError } from '../shared/domain-errors';

export const MAX_CANTIDAD_KG = 1_000_000;
export const MAX_VALOR_UNITARIO = 100_000_000;

export interface ReporteMaterial {
  codigo: number | null;
  nombre: string | null;
}

export interface ReporteEca {
  nombre: string | null;
  direccion: string | null;
  comuna: string | null;
  codigo_nuec?: string | null;
}

export interface ReporteRecuperador {
  nombre: string;
  apellido: string;
  cedula: string;
  tipo_documento?: string | null;
  placa_habitual?: string | null;
}

export interface ReporteUsuario {
  nombre: string | null;
  apellido: string | null;
  usuario: string | null;
}

export interface Reporte {
  consecutivo: number;
  comprobante?: string | null;
  numeroReporte: number;
  idMat: number;
  material: ReporteMaterial;
  cantidad: number;
  valor: number;
  subtotal: number;
  idUser: number;
  usuario: ReporteUsuario;
  idEca: number;
  idEcaMacroruta?: number | null;
  macroruta?: { codigo: string | null; nombre: string | null } | null;
  eca: ReporteEca;
  idRecuperador: number | null;
  recuperador: ReporteRecuperador | null;
  fechaRegistro: Date;
  fechaVenta: Date;
}

/** Valor de entrada ya validado por reglas de dominio; la persistencia lo convierte en Reporte. */
export class NuevoReporte {
  private constructor(
    readonly idMat: number,
    readonly cantidad: number,
    readonly valor: number,
    readonly idUser: number,
    readonly idEca: number,
    readonly idRecuperador: number,
    readonly fechaRegistro: Date,
    readonly fechaVenta: Date,
    readonly idEcaMacroruta?: number | null,
  ) {}

  static crear(props: {
    idMat: number;
    cantidad: number;
    valor: number;
    idUser: number;
    idEca: number;
    idRecuperador: number;
    fechaRegistro: Date;
    fechaVenta: Date;
    idEcaMacroruta?: number | null;
  }): NuevoReporte {
    validarImportesVenta(props.cantidad, props.valor);
    if (props.fechaVenta.getTime() > props.fechaRegistro.getTime()) {
      throw new ValidationError('La fecha de venta no puede ser posterior a la fecha de registro');
    }
    return new NuevoReporte(
      props.idMat,
      props.cantidad,
      props.valor,
      props.idUser,
      props.idEca,
      props.idRecuperador,
      props.fechaRegistro,
      props.fechaVenta,
      props.idEcaMacroruta,
    );
  }
}

export type CambiosReporte = Pick<NuevoReporte, 'idMat' | 'cantidad' | 'valor' | 'idEca' | 'fechaVenta' | 'idEcaMacroruta'>;

export function validarImportesVenta(cantidad: number, valor: number): void {
  if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > MAX_CANTIDAD_KG) {
    throw new ValidationError(`La cantidad debe ser mayor o igual que 0 y no superar ${MAX_CANTIDAD_KG} kg`);
  }
  if (!Number.isInteger(valor) || valor <= 0 || valor > MAX_VALOR_UNITARIO) {
    throw new ValidationError(`El valor unitario debe ser un entero mayor que 0 y no superar ${MAX_VALOR_UNITARIO}`);
  }
}

/** Subtotal en pesos (COP no usa decimales): cantidad (kg) * valor unitario, redondeado. */
export function calcularSubtotal(cantidad: number, valor: number): number {
  return Math.round(cantidad * valor);
}
