import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateRecuperadorDto,
  EstadoRecuperadorDto,
  RecuperadorResponseDto,
  UpdateRecuperadorDto,
} from '../../application/recuperadores/dto/recuperador.dto';
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
import { RoleName } from '../../shared/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';

@ApiTags('recuperadores')
@ApiBearerAuth('access-token')
@Controller('recuperadores')
export class RecuperadoresController {
  constructor(
    private readonly listRecuperadores: ListRecuperadoresUseCase,
    private readonly listEstados: ListEstadosRecuperadorUseCase,
    private readonly createRecuperador: CreateRecuperadorUseCase,
    private readonly getRecuperador: GetRecuperadorUseCase,
    private readonly updateRecuperador: UpdateRecuperadorUseCase,
    private readonly deleteRecuperador: DeleteRecuperadorUseCase,
    private readonly getByCedula: GetRecuperadorByCedulaUseCase,
    private readonly getDocumento: GetDocumentoRecuperadorUseCase,
  ) {}

  @Get('estados')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Catálogo de estados del recuperador (Activo, Inactivo, Fallecido)' })
  @ApiOkResponse({ type: [EstadoRecuperadorDto] })
  estados(): Promise<EstadoRecuperadorDto[]> {
    return this.listEstados.execute();
  }

  @Get()
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Lista recuperadores (sin foto; usa tiene_foto)' })
  @ApiOkResponse({ type: [RecuperadorResponseDto] })
  list(): Promise<RecuperadorResponseDto[]> {
    return this.listRecuperadores.execute();
  }

  @Post()
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiCreatedResponse({ type: RecuperadorResponseDto })
  create(@Body() dto: CreateRecuperadorDto, @CurrentUser() actor: AuthenticatedUser): Promise<RecuperadorResponseDto> {
    return this.createRecuperador.execute(dto, actor.id);
  }

  @Get('cedula/:cedula')
  @ApiOperation({ summary: 'Busca un recuperador por cédula (incluye su ECA y foto) para Crear Reporte' })
  @ApiOkResponse({ type: RecuperadorResponseDto })
  byCedula(@Param('cedula') cedula: string): Promise<RecuperadorResponseDto> {
    return this.getByCedula.execute(cedula);
  }

  @Get(':id')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Detalle de un recuperador (incluye la foto)' })
  @ApiOkResponse({ type: RecuperadorResponseDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<RecuperadorResponseDto> {
    return this.getRecuperador.execute(id);
  }

  @Get(':id/documentos/:documentoId')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Descarga un documento escaneado del recuperador' })
  async documento(@Param('id', ParseIntPipe) id: number, @Param('documentoId', ParseIntPipe) documentoId: number): Promise<StreamableFile> {
    const doc = await this.getDocumento.execute(id, documentoId);
    return new StreamableFile(doc.contenido, {
      type: doc.mime,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.nombre)}`,
    });
  }

  @Patch(':id')
  @Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
  @ApiOperation({ summary: 'Actualiza parcialmente un recuperador (omitir foto la conserva)' })
  @ApiOkResponse({ type: RecuperadorResponseDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRecuperadorDto, @CurrentUser() actor: AuthenticatedUser): Promise<RecuperadorResponseDto> {
    return this.updateRecuperador.execute(id, dto, actor.id);
  }

  @Delete(':id')
  @Roles(RoleName.ADMINISTRADOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Elimina un recuperador',
    description: 'Responde 409 si ya tiene ventas registradas; en ese caso cambia su estado a Inactivo.',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteRecuperador.execute(id);
  }
}
