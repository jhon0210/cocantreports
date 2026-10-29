import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_SESSION_REPOSITORY, RefreshSessionRepository } from '../../../domain/auth/refresh-session.repository';
import { UnauthorizedError } from '../../../domain/shared/domain-errors';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { CLOCK, Clock } from '../../ports/clock.port';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { AuthSession, SessionService } from '../session.service';

@Injectable()
export class LoginUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sesiones: RefreshSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly session: SessionService,
  ) {}

  async execute(usuario: string, clave: string): Promise<AuthSession> {
    const user = await this.usuarios.findByUsuario(usuario.trim());

    // Se compara siempre contra un hash para que el tiempo de respuesta no revele si el usuario existe.
    const hash = user?.claveHash ?? (await this.getDummyHash());
    const claveOk = await this.hasher.compare(clave, hash);

    if (!user || !claveOk || !user.activo || !user.perfil || user.claveHash === null) {
      throw new UnauthorizedError('Usuario o clave incorrectos');
    }

    await this.sesiones.deleteExpired(this.clock.now());
    return this.session.open(user);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomUUID());
    return this.dummyHash;
  }
}
