import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../../shared/constants/roles';

export const ROLES_KEY = 'roles';

/** Restringe el acceso a los perfiles indicados (valores de roles.perfil). Sin @Roles basta con estar autenticado. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
