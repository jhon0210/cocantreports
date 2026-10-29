import { Module } from '@nestjs/common';
import {
  CreateRecuperadorUseCase,
  DeleteRecuperadorUseCase,
  GetRecuperadorByCedulaUseCase,
  GetRecuperadorUseCase,
  ListEstadosRecuperadorUseCase,
  ListRecuperadoresUseCase,
  UpdateRecuperadorUseCase,
  GetDocumentoRecuperadorUseCase,
} from '../../application/recuperadores/use-cases/recuperadores.use-cases';
import { ESTADO_RECUPERADOR_REPOSITORY } from '../../domain/recuperadores/estado-recuperador.repository';
import { RECUPERADOR_REPOSITORY } from '../../domain/recuperadores/recuperador.repository';
import { PrismaEstadoRecuperadorRepository } from '../../infrastructure/persistence/recuperadores/prisma-estado-recuperador.repository';
import { PrismaRecuperadorRepository } from '../../infrastructure/persistence/recuperadores/prisma-recuperador.repository';
import { RecuperadoresController } from './recuperadores.controller';

@Module({
  imports: [],
  controllers: [RecuperadoresController],
  providers: [
    { provide: RECUPERADOR_REPOSITORY, useClass: PrismaRecuperadorRepository },
    { provide: ESTADO_RECUPERADOR_REPOSITORY, useClass: PrismaEstadoRecuperadorRepository },
    ListRecuperadoresUseCase,
    ListEstadosRecuperadorUseCase,
    CreateRecuperadorUseCase,
    GetRecuperadorUseCase,
    UpdateRecuperadorUseCase,
    DeleteRecuperadorUseCase,
    GetRecuperadorByCedulaUseCase,
    GetDocumentoRecuperadorUseCase,
  ],
  exports: [RECUPERADOR_REPOSITORY, GetRecuperadorByCedulaUseCase],
})
export class RecuperadoresModule {}
