import { Module } from '@nestjs/common';
import { CreateReporteUseCase } from '../../application/reportes/use-cases/create-reporte.use-case';
import { ManageReportesUseCase } from '../../application/reportes/use-cases/manage-reportes.use-cases';
import { GetReporteUseCase, ListReportesUseCase } from '../../application/reportes/use-cases/list-get-reportes.use-cases';
import { NextPrefacturaNumberUseCase } from '../../application/reportes/use-cases/next-prefactura-number.use-case';
import { REPORTE_REPOSITORY } from '../../domain/reportes/reporte.repository';
import { PrismaReporteRepository } from '../../infrastructure/persistence/reportes/prisma-reporte.repository';
import { MaterialesModule } from '../materiales/materiales.module';
import { EcasModule } from '../ecas/ecas.module';
import { RecuperadoresModule } from '../recuperadores/recuperadores.module';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [MaterialesModule, RecuperadoresModule, EcasModule],
  controllers: [ReportesController],
  providers: [
    { provide: REPORTE_REPOSITORY, useClass: PrismaReporteRepository },
    CreateReporteUseCase,
    ManageReportesUseCase,
    ListReportesUseCase,
    GetReporteUseCase,
    NextPrefacturaNumberUseCase,
  ],
})
export class ReportesModule {}
