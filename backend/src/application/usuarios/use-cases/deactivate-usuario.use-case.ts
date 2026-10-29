import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { UpdateUsuarioUseCase } from './update-usuario.use-case';

/** Baja lógica: conserva el usuario para no romper el historial de reportes. */
@Injectable()
export class DeactivateUsuarioUseCase {
  constructor(private readonly update: UpdateUsuarioUseCase) {}

  async execute(actor: AuthenticatedUser, id: number): Promise<void> {
    await this.update.execute(actor, id, { activo: false });
  }
}
