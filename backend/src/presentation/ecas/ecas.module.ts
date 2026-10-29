import { Module } from '@nestjs/common';
import { CreateEcaUseCase, DeleteEcaUseCase, GetEcaAdjuntoUseCase, ListEcasUseCase, UpdateEcaUseCase } from '../../application/ecas/use-cases/ecas.use-cases';
import { ECA_REPOSITORY } from '../../domain/ecas/eca.repository';
import { PrismaEcaRepository } from '../../infrastructure/persistence/ecas/prisma-eca.repository';
import { EcasController } from './ecas.controller';

@Module({
  controllers: [EcasController],
  providers: [{ provide: ECA_REPOSITORY, useClass: PrismaEcaRepository }, ListEcasUseCase, CreateEcaUseCase, UpdateEcaUseCase, DeleteEcaUseCase, GetEcaAdjuntoUseCase],
  exports: [ECA_REPOSITORY],
})
export class EcasModule {}
