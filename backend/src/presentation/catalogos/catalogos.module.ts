import { Module } from '@nestjs/common';
import { ListCargosUseCase, ListRolesUseCase } from '../../application/catalogos/use-cases/list-catalogos.use-cases';
import { CATALOGO_REPOSITORY } from '../../domain/catalogos/catalogo.repository';
import { PrismaCatalogoRepository } from '../../infrastructure/persistence/catalogos/prisma-catalogo.repository';
import { CatalogosController } from './catalogos.controller';

@Module({
  controllers: [CatalogosController],
  providers: [{ provide: CATALOGO_REPOSITORY, useClass: PrismaCatalogoRepository }, ListRolesUseCase, ListCargosUseCase],
  exports: [CATALOGO_REPOSITORY],
})
export class CatalogosModule {}
