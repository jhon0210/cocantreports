import { Usuario } from '../../../domain/usuarios/usuario.entity';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';

export class UsuarioMapper {
  /** Nunca incluye la clave ni su hash. */
  static toDto(u: Usuario): UsuarioResponseDto {
    return {
      id_user: u.id,
      nomUser: u.nombre,
      apeUser: u.apellido,
      usuario: u.usuario,
      cedula: u.cedula,
      id_perfil: u.idPerfil,
      perfil: u.perfil,
      id_cargo: u.idCargo,
      cargo: u.cargo,
      id_eca: u.idEca,
      eca: u.eca,
      activo: u.activo,
    };
  }
}
