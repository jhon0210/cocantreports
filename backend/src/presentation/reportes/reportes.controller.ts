import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateReporteDto, CreateReportesBatchDto, ListReportesQueryDto, ReporteResponseDto, UpdateReporteDto } from '../../application/reportes/dto/reporte.dto';
import { ManageReportesUseCase } from '../../application/reportes/use-cases/manage-reportes.use-cases';
import { CreateReporteUseCase } from '../../application/reportes/use-cases/create-reporte.use-case';
import { GetReporteUseCase, ListReportesUseCase } from '../../application/reportes/use-cases/list-get-reportes.use-cases';
import { NextPrefacturaNumberUseCase } from '../../application/reportes/use-cases/next-prefactura-number.use-case';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { ALL_ROLES, RoleName } from '../../shared/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

/** El Administrador Eca solo crea reportes: no consulta los guardados. */
const ROLES_REPORTE = ALL_ROLES;
const ROLES_CONSULTA = [RoleName.ADMINISTRADOR, RoleName.COORDINADOR, RoleName.OPERARIO] as const;

@ApiTags('reportes')
@ApiBearerAuth('access-token')
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly createReporte: CreateReporteUseCase,
    private readonly listReportes: ListReportesUseCase,
    private readonly getReporte: GetReporteUseCase,
    private readonly manageReportes: ManageReportesUseCase,
    private readonly nextPrefacturaNumber: NextPrefacturaNumberUseCase,
  ) {}

  @Post()
  @Roles(...ROLES_REPORTE)
  @ApiOperation({
    summary: 'Registra un reporte de venta',
    description:
      'id_user sale del token, id_eca se selecciona en la venta y FechaRegistro sale del servidor.',
  })
  @ApiCreatedResponse({ type: ReporteResponseDto })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateReporteDto): Promise<ReporteResponseDto> {
    return this.createReporte.execute(actor, dto);
  }

  @Post('lote')
  @Roles(...ROLES_REPORTE)
  @ApiOperation({ summary: 'Guarda todos los registros de un comprobante en una transacción' })
  @ApiCreatedResponse({ type: [ReporteResponseDto] })
  createBatch(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateReportesBatchDto): Promise<ReporteResponseDto[]> {
    return this.createReporte.executeBatch(actor, dto.registros);
  }

  @Post('prefacturas/consecutivo')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Reserva el siguiente consecutivo independiente para una prefactura' })
  @ApiCreatedResponse({ schema: { example: { numero_prefactura: 0 } } })
  async nextPrefactura(): Promise<{ numero_prefactura: number }> {
    return { numero_prefactura: await this.nextPrefacturaNumber.execute() };
  }

  @Get(':consecutivo/comprobante')
  @Roles(...ROLES_CONSULTA)
  @ApiOperation({ summary: 'Consulta todos los registros del comprobante para reimpresión; respeta la visibilidad del usuario' })
  @ApiOkResponse({ type: [ReporteResponseDto] })
  comprobante(@CurrentUser() actor: AuthenticatedUser, @Param('consecutivo', ParseIntPipe) id: number): Promise<ReporteResponseDto[]> {
    return this.manageReportes.comprobante(actor, id);
  }

  @Get('balance-masas')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Consulta paginada de ventas para el balance de masas; no completa datos inexistentes' })
  @ApiOkResponse({ type: [ReporteResponseDto] })
  balanceMasas(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListReportesQueryDto): Promise<ReporteResponseDto[]> {
    return this.listReportes.execute(actor, query);
  }

  @Put(':consecutivo')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Administrador o Coordinador: edita una línea de venta conservando autor, recuperador y comprobante' })
  @ApiOkResponse({ type: ReporteResponseDto })
  update(@CurrentUser() actor: AuthenticatedUser, @Param('consecutivo', ParseIntPipe) id: number, @Body() dto: UpdateReporteDto): Promise<ReporteResponseDto> {
    return this.manageReportes.update(actor, id, dto);
  }

  @Delete(':consecutivo')
  @Roles(RoleName.ADMINISTRADOR)
  @HttpCode(204)
  @ApiOperation({ summary: 'Administrador: elimina solo la línea seleccionada, sin borrar las demás del comprobante' })
  @ApiNoContentResponse()
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('consecutivo', ParseIntPipe) id: number): Promise<void> {
    return this.manageReportes.remove(actor, id);
  }

  @Get()
  @Roles(...ROLES_CONSULTA)
  @ApiOperation({ summary: 'Lista reportes: del usuario autenticado (Operario) o todos (Administrador/Coordinador)' })
  @ApiOkResponse({ type: [ReporteResponseDto] })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListReportesQueryDto): Promise<ReporteResponseDto[]> {
    return this.listReportes.execute(actor, query);
  }

  @Get(':consecutivo')
  @Roles(...ROLES_CONSULTA)
  @ApiOkResponse({ type: ReporteResponseDto })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('consecutivo', ParseIntPipe) consecutivo: number): Promise<ReporteResponseDto> {
    return this.getReporte.execute(actor, consecutivo);
  }
}
