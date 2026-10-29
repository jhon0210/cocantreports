import { CambiosRecuperador, NuevoRecuperador, Recuperador } from './recuperador.entity';

export const RECUPERADOR_REPOSITORY = Symbol('RECUPERADOR_REPOSITORY');

export interface RecuperadorRepository {
  /** El listado omite la foto (pesada); `tieneFoto` indica si existe. */
  list(): Promise<Recuperador[]>;
  findById(id: number): Promise<Recuperador | null>;
  findByCedula(cedula: string): Promise<Recuperador | null>;
  findByCodigoRegistro(codigo: string): Promise<Recuperador | null>;
  create(data: NuevoRecuperador): Promise<Recuperador>;
  update(id: number, changes: CambiosRecuperador): Promise<Recuperador>;
  delete(id: number): Promise<void>;
  /** Indica si el recuperador ya tiene ventas registradas (impide su eliminación física). */
  hasReportes(id: number): Promise<boolean>;
  findDocumento(recuperadorId: number, documentoId: number): Promise<{ nombre: string; mime: string; contenido: Uint8Array } | null>;
}
