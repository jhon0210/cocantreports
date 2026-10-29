import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../domain/shared/domain-errors';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { UsuarioResponseDto } from '../../usuarios/dto/usuario-response.dto';
import { UsuarioMapper } from '../../usuarios/mappers/usuario.mapper';
import { AuthMapper } from '../mappers/auth.mapper';

@Injectable()
export class GetAuthenticatedUserUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository) {}

  /** Carga el usuario desde la BD para que desactivaciones y cambios de perfil apliquen de inmediato. */
  async execute(userId: number): Promise<AuthenticatedUser> {
    const user = await this.usuarios.findById(userId);
    if (!user || !user.activo || !user.perfil || user.idPerfil === null) {
      throw new UnauthorizedError('Usuario no autorizado');
    }
    return AuthMapper.toAuthenticatedUser(user);
  }

  async profile(userId: number): Promise<UsuarioResponseDto> {
    const user = await this.usuarios.findById(userId);
    if (!user || !user.activo) throw new UnauthorizedError('Usuario no autorizado');
    return UsuarioMapper.toDto(user);
  }
}
