import { Material } from './material.entity';

export const MATERIAL_REPOSITORY = Symbol('MATERIAL_REPOSITORY');

export interface MaterialRepository {
  list(): Promise<Material[]>;
  findById(id: number): Promise<Material | null>;
}
