import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ALL_ROLES, RoleName } from '../../../shared/constants/roles';
import { EcasController } from '../../ecas/ecas.controller';
import { RecuperadoresController } from '../../recuperadores/recuperadores.controller';
import { ReportesController } from '../../reportes/reportes.controller';
import { UsuariosController } from '../../usuarios/usuarios.controller';
import { RolesGuard } from './roles.guard';

const managers: RoleName[] = [RoleName.ADMINISTRADOR, RoleName.COORDINADOR];
const admin: RoleName[] = [RoleName.ADMINISTRADOR];
const consulta: RoleName[] = [RoleName.ADMINISTRADOR, RoleName.COORDINADOR, RoleName.OPERARIO];
const routes = [
  { controller: EcasController, handler: EcasController.prototype.list, allowed: ALL_ROLES },
  { controller: EcasController, handler: EcasController.prototype.create, allowed: managers },
  { controller: EcasController, handler: EcasController.prototype.update, allowed: managers },
  { controller: EcasController, handler: EcasController.prototype.download, allowed: managers },
  { controller: EcasController, handler: EcasController.prototype.remove, allowed: admin },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.list, allowed: managers },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.estados, allowed: managers },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.get, allowed: managers },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.byCedula, allowed: ALL_ROLES },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.create, allowed: managers },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.update, allowed: managers },
  { controller: RecuperadoresController, handler: RecuperadoresController.prototype.remove, allowed: admin },
  { controller: UsuariosController, handler: UsuariosController.prototype.list, allowed: managers },
  { controller: UsuariosController, handler: UsuariosController.prototype.get, allowed: managers },
  { controller: UsuariosController, handler: UsuariosController.prototype.buscarPorCedula, allowed: ALL_ROLES },
  { controller: UsuariosController, handler: UsuariosController.prototype.create, allowed: managers },
  { controller: UsuariosController, handler: UsuariosController.prototype.update, allowed: managers },
  { controller: UsuariosController, handler: UsuariosController.prototype.remove, allowed: admin },
  { controller: ReportesController, handler: ReportesController.prototype.list, allowed: consulta },
  { controller: ReportesController, handler: ReportesController.prototype.get, allowed: consulta },
  { controller: ReportesController, handler: ReportesController.prototype.comprobante, allowed: consulta },
  { controller: ReportesController, handler: ReportesController.prototype.create, allowed: ALL_ROLES },
  { controller: ReportesController, handler: ReportesController.prototype.createBatch, allowed: ALL_ROLES },
  { controller: ReportesController, handler: ReportesController.prototype.update, allowed: managers },
  { controller: ReportesController, handler: ReportesController.prototype.remove, allowed: admin },
];

describe('Permisos de los módulos', () => {
  const guard = new RolesGuard(new Reflector());

  it.each(routes.flatMap(({ controller, handler, allowed }) => ALL_ROLES.map((perfil) => ({
    module: controller.name,
    action: handler.name,
    controller,
    handler,
    perfil,
    permitted: allowed.includes(perfil),
  }))))('$module.$action para $perfil: permitido=$permitted', ({ controller, handler, perfil, permitted }) => {
    const context = new ExecutionContextHost([{ user: { perfil } }], controller, handler);
    if (permitted) expect(guard.canActivate(context)).toBe(true);
    else expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
