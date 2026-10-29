import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ArchivosService } from '../../application/archivos/archivos.service';
import { AutorizarArchivoDto } from '../../application/archivos/archivo.dto';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { RoleName } from '../../shared/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('archivos')
@Roles(RoleName.ADMINISTRADOR, RoleName.COORDINADOR)
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  @Get('config')
  config() { return this.archivos.config(); }

  @Post('autorizar')
  authorize(@Body() dto: AutorizarArchivoDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.archivos.authorize(dto, actor.id);
  }

  @Post(':id/confirmar')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.archivos.confirm(id, actor.id);
  }

  @Post('limpiar')
  @Roles(RoleName.ADMINISTRADOR)
  cleanup() { return this.archivos.cleanup(); }
}
