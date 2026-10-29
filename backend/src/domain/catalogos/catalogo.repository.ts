import { Cargo, Rol } from './catalogo.entity';

export const CATALOGO_REPOSITORY = Symbol('CATALOGO_REPOSITORY');

export interface CatalogoRepository {
  listRoles(): Promise<Rol[]>;
  findRolById(id: number): Promise<Rol | null>;
  listCargos(): Promise<Cargo[]>;
  findCargoById(id: number): Promise<Cargo | null>;
}
