import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateEcaDto, EcaResponseDto, UpdateEcaDto } from '../../application/ecas/dto/eca.dto';
import { CreateEcaUseCase, DeleteEcaUseCase, GetEcaAdjuntoUseCase, ListEcasUseCase, UpdateEcaUseCase } from '../../application/ecas/use-cases/ecas.use-cases';
import { RoleName } from '../../shared/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';

@ApiTags('ecas')
@ApiBearerAuth('access-token')
@Controller('ecas')
export class EcasController {
  constructor(
    private readonly listEcas: ListEcasUseCase,
    private readonly createEca: CreateEcaUseCase,
    private readonly updateEca: UpdateEcaUseCase,
    private readonly deleteEca: DeleteEcaUseCase,
    private readonly getAdjunto: GetEcaAdjuntoUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista de ECAs (la usa Crear Reporte para elegir la bodega de la venta)' })
  @ApiOkResponse({ type: [EcaResponseDto] })
  list(): Promise<EcaResponseDto[]> {
    return this.listEcas.execute();
  }

  @Post()
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiCreatedResponse({ type: EcaResponseDto })
  create(@Body() dto: CreateEcaDto, @CurrentUser() actor: AuthenticatedUser): Promise<EcaResponseDto> {
    return this.createEca.execute(dto, actor.id);
  }

  @Get(':id/adjuntos/:adjuntoId')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Descarga un PDF adjunto a la ECA' })
  async download(@Param('id', ParseIntPipe) id: number, @Param('adjuntoId', ParseIntPipe) adjuntoId: number): Promise<StreamableFile> {
    const adjunto = await this.getAdjunto.execute(id, adjuntoId);
    return new StreamableFile(adjunto.contenido, {
      type: 'application/pdf',
      disposition: `attachment; filename="documento.pdf"; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
      length: adjunto.tamano,
    });
  }

  @Put(':id')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOkResponse({ type: EcaResponseDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEcaDto, @CurrentUser() actor: AuthenticatedUser): Promise<EcaResponseDto> {
    return this.updateEca.execute(id, dto, actor.id);
  }

  @Delete(':id')
  @Roles(RoleName.ADMINISTRADOR)
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina una ECA sin reportes de ventas vinculados' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteEca.execute(id);
  }
}
