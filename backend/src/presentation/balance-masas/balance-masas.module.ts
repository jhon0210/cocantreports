import { Module } from '@nestjs/common';
import { BalanceMasasUseCases } from '../../application/balance-masas/balance.use-cases';
import { BALANCE_REPOSITORY } from '../../domain/balance-masas/balance.repository';
import { PrismaBalanceRepository } from '../../infrastructure/persistence/balance-masas/prisma-balance.repository';
import { EcasModule } from '../ecas/ecas.module';
import { MaterialesModule } from '../materiales/materiales.module';
import { BalanceMasasController } from './balance-masas.controller';

@Module({
  imports: [EcasModule, MaterialesModule],
  controllers: [BalanceMasasController],
  providers: [BalanceMasasUseCases, { provide: BALANCE_REPOSITORY, useClass: PrismaBalanceRepository }],
})
export class BalanceMasasModule {}
