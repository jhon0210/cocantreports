import { Module } from '@nestjs/common';
import { GetMaterialUseCase, ListMaterialesUseCase } from '../../application/materiales/use-cases/materiales.use-cases';
import { MATERIAL_REPOSITORY } from '../../domain/materiales/material.repository';
import { PrismaMaterialRepository } from '../../infrastructure/persistence/materiales/prisma-material.repository';
import { MaterialesController } from './materiales.controller';

@Module({
  controllers: [MaterialesController],
  providers: [{ provide: MATERIAL_REPOSITORY, useClass: PrismaMaterialRepository }, ListMaterialesUseCase, GetMaterialUseCase],
  exports: [MATERIAL_REPOSITORY],
})
export class MaterialesModule {}
