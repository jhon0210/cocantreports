import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/shared/domain-errors';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';
import { UsuarioMapper } from '../mappers/usuario.mapper';

@Injectable()
export class GetUsuarioUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository) {}

  async execute(id: number): Promise<UsuarioResponseDto> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario) throw new NotFoundError(`No existe el usuario ${id}`);
    return UsuarioMapper.toDto(usuario);
  }
}
