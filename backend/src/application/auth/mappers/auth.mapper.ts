import { Usuario } from '../../../domain/usuarios/usuario.entity';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { UsuarioMapper } from '../../usuarios/mappers/usuario.mapper';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { AuthSession } from '../session.service';

export class AuthMapper {
  static toResponse(session: AuthSession): AuthResponseDto {
    return {
      access_token: session.accessToken,
      token_type: 'Bearer',
      expires_in: session.expiresIn,
      user: UsuarioMapper.toDto(session.user),
    };
  }

  static toAuthenticatedUser(u: Usuario): AuthenticatedUser {
    return {
      id: u.id,
      usuario: u.usuario,
      nombre: u.nombre,
      apellido: u.apellido,
      idPerfil: u.idPerfil!,
      perfil: u.perfil!,
      idEca: u.idEca,
    };
  }
}
