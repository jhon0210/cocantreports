import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_SESSION_REPOSITORY, RefreshSessionRepository } from '../../../domain/auth/refresh-session.repository';
import { CATALOGO_REPOSITORY, CatalogoRepository } from '../../../domain/catalogos/catalogo.repository';
import { ECA_REPOSITORY, EcaRepository } from '../../../domain/ecas/eca.repository';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../../domain/shared/domain-errors';
import { CambiosUsuario } from '../../../domain/usuarios/usuario.entity';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { RoleName } from '../../../shared/constants/roles';
import { CLOCK, Clock } from '../../ports/clock.port';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { UpdateUsuarioDto } from '../dto/usuario.dto';
import { UsuarioResponseDto } from '../dto/usuario-response.dto';
import { UsuarioMapper } from '../mappers/usuario.mapper';
import { assertCanManagePerfil, resolveEcaAsociada } from '../usuario-policy';

@Injectable()
export class UpdateUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(CATALOGO_REPOSITORY) private readonly catalogos: CatalogoRepository,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sesiones: RefreshSessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ECA_REPOSITORY) private readonly ecas: EcaRepository,
  ) {}

  async execute(actor: AuthenticatedUser, id: number, dto: UpdateUsuarioDto): Promise<UsuarioResponseDto> {
    if (dto.activo === false && actor.perfil !== RoleName.ADMINISTRADOR) {
      throw new ForbiddenError('Solo un Administrador puede desactivar usuarios');
    }
    const objetivo = await this.usuarios.findById(id);
    if (!objetivo) throw new NotFoundError(`No existe el usuario ${id}`);
    assertCanManagePerfil(actor, objetivo.perfil);

    const cambios: CambiosUsuario = {};
    if (dto.nomUser !== undefined) cambios.nombre = dto.nomUser;
    if (dto.apeUser !== undefined) cambios.apellido = dto.apeUser;

    if (dto.usuario !== undefined && dto.usuario !== objetivo.usuario) {
      const otro = await this.usuarios.findByUsuario(dto.usuario);
      if (otro && otro.id !== id) throw new ConflictError(`El usuario "${dto.usuario}" ya existe`);
      cambios.usuario = dto.usuario;
    }

    if (dto.cedula !== undefined && dto.cedula !== objetivo.cedula) {
      const otro = await this.usuarios.findByCedula(dto.cedula);
      if (otro && otro.id !== id) throw new ConflictError(`Ya existe un usuario con la cédula ${dto.cedula}`);
      cambios.cedula = dto.cedula;
    }

    let perfilFinal = objetivo.perfil;
    if (dto.id_perfil !== undefined && dto.id_perfil !== objetivo.idPerfil) {
      if (actor.id === id) throw new BusinessRuleError('No puedes cambiar tu propio perfil');
      const rol = await this.catalogos.findRolById(dto.id_perfil);
      if (!rol) throw new NotFoundError(`No existe el perfil ${dto.id_perfil}`);
      assertCanManagePerfil(actor, rol.perfil);
      cambios.idPerfil = dto.id_perfil;
      perfilFinal = rol.perfil;
    }

    if (cambios.idPerfil !== undefined || dto.id_eca !== undefined) {
      const idEca = await resolveEcaAsociada(perfilFinal, dto.id_eca ?? null, this.ecas);
      if (idEca !== objetivo.idEca) cambios.idEca = idEca;
    }

    if (dto.id_cargo !== undefined) {
      if (!(await this.catalogos.findCargoById(dto.id_cargo))) throw new NotFoundError(`No existe el cargo ${dto.id_cargo}`);
      cambios.idCargo = dto.id_cargo;
    }

    if (dto.activo !== undefined && dto.activo !== objetivo.activo) {
      if (actor.id === id && !dto.activo) throw new BusinessRuleError('No puedes desactivar tu propia cuenta');
      cambios.activo = dto.activo;
    }

    if (dto.clave !== undefined) cambios.claveHash = await this.hasher.hash(dto.clave);

    if (Object.keys(cambios).length === 0) return UsuarioMapper.toDto(objetivo);

    const actualizado = await this.usuarios.update(id, cambios);

    // Cambios sensibles invalidan las sesiones abiertas del usuario.
    if (cambios.claveHash || cambios.activo === false || cambios.idPerfil !== undefined) {
      await this.sesiones.revokeAllForUser(id, this.clock.now());
    }
    return UsuarioMapper.toDto(actualizado);
  }
}
