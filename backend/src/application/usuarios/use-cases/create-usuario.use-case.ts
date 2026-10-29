import { Inject, Injectable } from '@nestjs/common';
import { CATALOGO_REPOSITORY, CatalogoRepository } from '../../../domain/catalogos/catalogo.repository';
import { ECA_REPOSITORY, EcaRepository } from '../../../domain/ecas/eca.repository';
import { ConflictError, NotFoundError } from '../../../domain/shared/domain-errors';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { CreateUsuarioDto } from '../dto/usuario.dto';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';
import { UsuarioMapper } from '../mappers/usuario.mapper';
import { assertCanManagePerfil, resolveEcaAsociada } from '../usuario-policy';

@Injectable()
export class CreateUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(CATALOGO_REPOSITORY) private readonly catalogos: CatalogoRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository,
  ) {}

  async execute(actor: AuthenticatedUser, dto: CreateUsuarioDto): Promise<UsuarioResponseDto> {
    const rol = await this.catalogos.findRolById(dto.id_perfil);
    if (!rol) throw new NotFoundError(`No existe el perfil ${dto.id_perfil}`);
    assertCanManagePerfil(actor, rol.perfil);
    const idEca = await resolveEcaAsociada(rol.perfil, dto.id_eca ?? null, this.ecas);

    if (dto.id_cargo != null && !(await this.catalogos.findCargoById(dto.id_cargo))) {
      throw new NotFoundError(`No existe el cargo ${dto.id_cargo}`);
    }
    if (await this.usuarios.findByUsuario(dto.usuario)) {
      throw new ConflictError(`El usuario "${dto.usuario}" ya existe`);
    }
    if (await this.usuarios.findByCedula(dto.cedula)) {
      throw new ConflictError(`Ya existe un usuario con la cédula ${dto.cedula}`);
    }

    const created = await this.usuarios.create({
      nombre: dto.nomUser,
      apellido: dto.apeUser,
      usuario: dto.usuario,
      claveHash: await this.hasher.hash(dto.clave),
      cedula: dto.cedula,
      idPerfil: dto.id_perfil,
      idCargo: dto.id_cargo ?? null,
      idEca,
    });
    return UsuarioMapper.toDto(created);
  }
}
