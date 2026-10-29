import { Inject, Injectable } from '@nestjs/common';
import { CATALOGO_REPOSITORY, CatalogoRepository } from '../../../domain/catalogos/catalogo.repository';
import { RoleName } from '../../../shared/constants/roles';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { CargoDto, RolDto } from '../dto/catalogo.dto';

@Injectable()
export class ListRolesUseCase {
  constructor(@Inject(CATALOGO_REPOSITORY) private readonly catalogos: CatalogoRepository) {}

  /** Un Coordinador no puede asignar el perfil Administrador, así que no se le ofrece. */
  async execute(actor: AuthenticatedUser): Promise<RolDto[]> {
    const roles = await this.catalogos.listRoles();
    return roles
      .filter((r) => actor.perfil === RoleName.ADMINISTRADOR || r.perfil !== RoleName.ADMINISTRADOR)
      .map((r) => ({ id_perfil: r.id, perfil: r.perfil }));
  }
}

@Injectable()
export class ListCargosUseCase {
  constructor(@Inject(CATALOGO_REPOSITORY) private readonly catalogos: CatalogoRepository) {}

  async execute(): Promise<CargoDto[]> {
    const cargos = await this.catalogos.listCargos();
    return cargos.map((c) => ({ id_cargo: c.id, cargo: c.cargo, estado: c.estado }));
  }
}
