import { EcaRepository } from '../../domain/ecas/eca.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/shared/domain-errors';
import { RoleName } from '../../shared/constants/roles';
import { AuthenticatedUser } from '../shared/authenticated-user';

/** Solo un Administrador puede crear, modificar o desactivar cuentas de Administrador (evita escalada de privilegios). */
export function assertCanManagePerfil(actor: AuthenticatedUser, perfilObjetivo: string | null): void {
  if (perfilObjetivo === RoleName.ADMINISTRADOR && actor.perfil !== RoleName.ADMINISTRADOR) {
    throw new ForbiddenError('Solo un Administrador puede gestionar cuentas de Administrador');
  }
}

/** El perfil Administrador Eca exige una ECA existente; los demás perfiles no pueden tener ECA asociada. */
export async function resolveEcaAsociada(perfil: string | null, idEca: number | null, ecas: EcaRepository): Promise<number | null> {
  if (perfil !== RoleName.ADMINISTRADOR_ECA) {
    if (idEca !== null) throw new ValidationError('Solo el perfil Administrador Eca puede tener una ECA asociada');
    return null;
  }
  if (idEca === null) throw new ValidationError('El perfil Administrador Eca requiere una ECA asociada');
  if (!(await ecas.findById(idEca))) throw new NotFoundError(`No existe la ECA ${idEca}`);
  return idEca;
}
