import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';
import { UsuarioMapper } from '../mappers/usuario.mapper';

@Injectable()
export class ListUsuariosUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository) {}

  async execute(): Promise<UsuarioResponseDto[]> {
    return (await this.usuarios.list()).map(UsuarioMapper.toDto);
  }
}
