import { Body, Controller, Get, HttpCode, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsultaBalanceDto, GuardarBalanceDto } from '../../application/balance-masas/balance.dto';
import { BalanceMasasUseCases } from '../../application/balance-masas/balance.use-cases';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { RoleName } from '../../shared/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('balance-masas')
@ApiBearerAuth('access-token')
@Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
@Controller('balance-masas')
export class BalanceMasasController {
  constructor(private readonly balances: BalanceMasasUseCases) {}

  @Get()
  @ApiOperation({ summary: 'Resumen mensual interno de entradas, salidas, rechazos e inventario; no certifica cargue SUI' })
  consultar(@Query() dto: ConsultaBalanceDto) {
    return this.balances.consultar(dto);
  }

  @Put()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Guarda cantidades mensuales medidas y sus referencias de soporte por ECA y material' })
  guardar(@Body() dto: GuardarBalanceDto, @CurrentUser() actor: AuthenticatedUser): Promise<void> {
    return this.balances.guardar(dto, actor.id);
  }
}
