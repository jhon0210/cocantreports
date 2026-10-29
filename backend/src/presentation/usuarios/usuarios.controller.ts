import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { CreateUsuarioDto, UpdateUsuarioDto } from '../../application/usuarios/dto/usuario.dto';
import { UsuarioResponseDto } from '../../application/usuarios/dto/usuario-response.dto';
import { CreateUsuarioUseCase } from '../../application/usuarios/use-cases/create-usuario.use-case';
import { DeactivateUsuarioUseCase } from '../../application/usuarios/use-cases/deactivate-usuario.use-case';
import { GetUsuarioUseCase } from '../../application/usuarios/use-cases/get-usuario.use-case';
import { ListUsuariosUseCase } from '../../application/usuarios/use-cases/list-usuarios.use-case';
import { UpdateUsuarioUseCase } from '../../application/usuarios/use-cases/update-usuario.use-case';
import { RecuperadorResponseDto } from '../../application/recuperadores/dto/recuperador.dto';
import { GetRecuperadorByCedulaUseCase } from '../../application/recuperadores/use-cases/recuperadores.use-cases';
import { ALL_ROLES, RoleName } from '../../shared/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('usuarios')
@ApiBearerAuth('access-token')
@Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly createUsuario: CreateUsuarioUseCase,
    private readonly listUsuarios: ListUsuariosUseCase,
    private readonly getUsuario: GetUsuarioUseCase,
    private readonly updateUsuario: UpdateUsuarioUseCase,
    private readonly deactivateUsuario: DeactivateUsuarioUseCase,
    private readonly getRecuperadorByCedula: GetRecuperadorByCedulaUseCase,
  ) {}

  @Get('cedula/:cedula')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Busca un recuperador por cédula (delega en el caso de uso de Recuperadores)' })
  @ApiOkResponse({ type: RecuperadorResponseDto })
  buscarPorCedula(@Param('cedula') cedula: string): Promise<RecuperadorResponseDto> {
    return this.getRecuperadorByCedula.execute(cedula);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario con su perfil (la clave se guarda hasheada)' })
  @ApiCreatedResponse({ type: UsuarioResponseDto })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUsuarioDto): Promise<UsuarioResponseDto> {
    return this.createUsuario.execute(actor, dto);
  }

  @Get()
  @ApiOkResponse({ type: [UsuarioResponseDto] })
  list(): Promise<UsuarioResponseDto[]> {
    return this.listUsuarios.execute();
  }

  @Get(':id')
  @ApiOkResponse({ type: UsuarioResponseDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<UsuarioResponseDto> {
    return this.getUsuario.execute(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UsuarioResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ): Promise<UsuarioResponseDto> {
    return this.updateUsuario.execute(actor, id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.ADMINISTRADOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva (baja lógica) al usuario y revoca sus sesiones' })
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deactivateUsuario.execute(actor, id);
  }
}
