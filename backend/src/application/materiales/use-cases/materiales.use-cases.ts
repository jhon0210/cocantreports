import { Inject, Injectable } from '@nestjs/common';
import { MATERIAL_REPOSITORY, MaterialRepository } from '../../../domain/materiales/material.repository';
import { NotFoundError } from '../../../domain/shared/domain-errors';
import { MaterialDto } from '../dto/material.dto';
import { MaterialMapper } from '../mappers/material.mapper';

@Injectable()
export class ListMaterialesUseCase {
  constructor(@Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository) {}

  async execute(): Promise<MaterialDto[]> {
    return (await this.materiales.list()).map(MaterialMapper.toDto);
  }
}

@Injectable()
export class GetMaterialUseCase {
  constructor(@Inject(MATERIAL_REPOSITORY) private readonly materiales: MaterialRepository) {}

  async execute(id: number): Promise<MaterialDto> {
    const material = await this.materiales.findById(id);
    if (!material) throw new NotFoundError(`No existe el material ${id}`);
    return MaterialMapper.toDto(material);
  }
}
