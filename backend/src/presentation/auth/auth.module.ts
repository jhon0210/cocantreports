import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionService } from '../../application/auth/session.service';
import { GetAuthenticatedUserUseCase } from '../../application/auth/use-cases/get-authenticated-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../application/auth/use-cases/refresh-session.use-case';
import { REFRESH_SESSION_REPOSITORY } from '../../domain/auth/refresh-session.repository';
import { PrismaRefreshSessionRepository } from '../../infrastructure/persistence/auth/prisma-refresh-session.repository';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshCookieService } from './refresh-cookie.service';

@Module({
  imports: [PassportModule, UsuariosModule],
  controllers: [AuthController],
  providers: [
    { provide: REFRESH_SESSION_REPOSITORY, useClass: PrismaRefreshSessionRepository },
    SessionService,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetAuthenticatedUserUseCase,
    RefreshCookieService,
    JwtStrategy,
  ],
})
export class AuthModule {}
