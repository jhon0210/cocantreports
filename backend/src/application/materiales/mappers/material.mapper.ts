import { Material } from '../../../domain/materiales/material.entity';
import { MaterialDto } from '../dto/material.dto';

export class MaterialMapper {
  static toDto(m: Material): MaterialDto {
    return { id_mat: m.id, codigo: m.codigo, nomMaterial: m.nombre };
  }
}
