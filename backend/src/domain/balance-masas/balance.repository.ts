import { FuenteBalance, GuardarBalance } from './balance.entity';

export const BALANCE_REPOSITORY = Symbol('BALANCE_REPOSITORY');

export interface BalanceRepository {
  consultar(periodo: string, idEca?: number): Promise<FuenteBalance[]>;
  guardar(captura: GuardarBalance): Promise<void>;
}
