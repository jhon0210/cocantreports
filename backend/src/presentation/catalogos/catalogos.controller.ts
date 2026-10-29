import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CargoDto, RolDto } from '../../application/catalogos/dto/catalogo.dto';
import { ListCargosUseCase, ListRolesUseCase } from '../../application/catalogos/use-cases/list-catalogos.use-cases';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { RoleName } from '../../shared/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('catalogos')
@ApiBearerAuth('access-token')
@Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly listCargos: ListCargosUseCase,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'Perfiles asignables (un Coordinador no ve Administrador)' })
  @ApiOkResponse({ type: [RolDto] })
  roles(@CurrentUser() user: AuthenticatedUser): Promise<RolDto[]> {
    return this.listRoles.execute(user);
  }

  @Get('cargos')
  @ApiOkResponse({ type: [CargoDto] })
  cargos(): Promise<CargoDto[]> {
    return this.listCargos.execute();
  }
}
