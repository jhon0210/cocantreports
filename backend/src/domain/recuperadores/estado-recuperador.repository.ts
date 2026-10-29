import { EstadoRecuperador } from './estado-recuperador.entity';

export const ESTADO_RECUPERADOR_REPOSITORY = Symbol('ESTADO_RECUPERADOR_REPOSITORY');

export interface EstadoRecuperadorRepository {
  list(): Promise<EstadoRecuperador[]>;
  findById(id: number): Promise<EstadoRecuperador | null>;
}
