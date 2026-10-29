import { Module } from '@nestjs/common';
import { CreateUsuarioUseCase } from '../../application/usuarios/use-cases/create-usuario.use-case';
import { DeactivateUsuarioUseCase } from '../../application/usuarios/use-cases/deactivate-usuario.use-case';
import { GetUsuarioUseCase } from '../../application/usuarios/use-cases/get-usuario.use-case';
import { ListUsuariosUseCase } from '../../application/usuarios/use-cases/list-usuarios.use-case';
import { UpdateUsuarioUseCase } from '../../application/usuarios/use-cases/update-usuario.use-case';
import { REFRESH_SESSION_REPOSITORY } from '../../domain/auth/refresh-session.repository';
import { USUARIO_REPOSITORY } from '../../domain/usuarios/usuario.repository';
import { PrismaRefreshSessionRepository } from '../../infrastructure/persistence/auth/prisma-refresh-session.repository';
import { PrismaUsuarioRepository } from '../../infrastructure/persistence/usuarios/prisma-usuario.repository';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { EcasModule } from '../ecas/ecas.module';
import { RecuperadoresModule } from '../recuperadores/recuperadores.module';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [CatalogosModule, RecuperadoresModule, EcasModule],
  controllers: [UsuariosController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: REFRESH_SESSION_REPOSITORY, useClass: PrismaRefreshSessionRepository },
    CreateUsuarioUseCase,
    ListUsuariosUseCase,
    GetUsuarioUseCase,
    UpdateUsuarioUseCase,
    DeactivateUsuarioUseCase,
  ],
  exports: [USUARIO_REPOSITORY],
})
export class UsuariosModule {}
