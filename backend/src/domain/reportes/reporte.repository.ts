import { CambiosReporte, NuevoReporte, Reporte } from './reporte.entity';

export const REPORTE_REPOSITORY = Symbol('REPORTE_REPOSITORY');

export interface ReporteFiltro {
  /** Si se define, solo los reportes registrados por ese usuario. */
  idUser?: number;
  ventaDesde?: Date;
  ventaHasta?: Date;
  registroDesde?: Date;
  registroHasta?: Date;
  cedula?: string;
  idEca?: number;
  idMat?: number;
  limit: number;
  offset: number;
}

export interface ReporteRepository {
  create(data: NuevoReporte): Promise<Reporte>;
  createBatch(data: NuevoReporte[]): Promise<Reporte[]>;
  update(consecutivo: number, data: CambiosReporte): Promise<Reporte>;
  delete(consecutivo: number): Promise<void>;
  findComprobante(consecutivo: number): Promise<Reporte[]>;
  findById(consecutivo: number): Promise<Reporte | null>;
  list(filtro: ReporteFiltro): Promise<Reporte[]>;
}
