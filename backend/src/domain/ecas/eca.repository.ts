import { AdjuntoEca, CambiosEca, Eca, NuevaEca } from './eca.entity';

export const ECA_REPOSITORY = Symbol('ECA_REPOSITORY');

export interface EcaRepository {
  list(): Promise<Eca[]>;
  findById(id: number): Promise<Eca | null>;
  create(data: NuevaEca): Promise<Eca>;
  update(id: number, changes: CambiosEca): Promise<Eca>;
  delete(id: number): Promise<void>;
  hasRelations(id: number): Promise<boolean>;
  findAdjunto(ecaId: number, adjuntoId: number): Promise<(AdjuntoEca & { contenido: Uint8Array }) | null>;
}
