import { Module } from '@nestjs/common';
import { ArchivosModule } from './infrastructure/storage/archivos.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appConfig } from './infrastructure/config/app.config';
import { envValidationSchema } from './infrastructure/config/env.validation';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './presentation/auth/auth.module';
import { CatalogosModule } from './presentation/catalogos/catalogos.module';
import { JwtAuthGuard } from './presentation/common/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/common/guards/roles.guard';
import { LoggingInterceptor } from './presentation/common/interceptors/logging.interceptor';
import { EcasModule } from './presentation/ecas/ecas.module';
import { MaterialesModule } from './presentation/materiales/materiales.module';
import { RecuperadoresModule } from './presentation/recuperadores/recuperadores.module';
import { ReportesModule } from './presentation/reportes/reportes.module';
import { UsuariosModule } from './presentation/usuarios/usuarios.module';
import { BalanceMasasModule } from './presentation/balance-masas/balance-masas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    ArchivosModule,
    InfrastructureModule,
    AuthModule,
    UsuariosModule,
    CatalogosModule,
    MaterialesModule,
    EcasModule,
    RecuperadoresModule,
    ReportesModule,
    BalanceMasasModule,
  ],
  providers: [
    // Orden: límite de peticiones -> autenticación JWT (todo protegido salvo @Public) -> roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
