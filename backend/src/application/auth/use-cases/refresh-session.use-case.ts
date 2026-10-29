import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_SESSION_REPOSITORY, RefreshSessionRepository } from '../../../domain/auth/refresh-session.repository';
import { UnauthorizedError } from '../../../domain/shared/domain-errors';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../domain/usuarios/usuario.repository';
import { CLOCK, Clock } from '../../ports/clock.port';
import { TOKEN_SERVICE, TokenService } from '../../ports/token-service.port';
import { AuthSession, SessionService } from '../session.service';

/** Ventana en la que reutilizar un token recién rotado se trata como carrera (p. ej. dos pestañas), no como robo. */
export const REUSE_GRACE_MS = 10_000;

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sesiones: RefreshSessionRepository,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly session: SessionService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<AuthSession> {
    if (!refreshToken) throw new UnauthorizedError('Sesión no encontrada');

    const claims = await this.tokens.verifyRefreshToken(refreshToken);
    const now = this.clock.now();

    const stored = await this.sesiones.findById(claims.jti);
    if (!stored || stored.userId !== claims.sub || stored.familia !== claims.fam || !this.hashMatches(stored.tokenHash, refreshToken)) {
      throw new UnauthorizedError('Sesión inválida');
    }

    if (stored.revokedAt) {
      // Un token ya usado/revocado que reaparece fuera de la ventana de gracia sugiere robo: se revoca toda la familia.
      if (now.getTime() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.sesiones.revokeFamily(stored.familia, now);
      }
      throw new UnauthorizedError('Sesión inválida');
    }
    if (stored.expiresAt.getTime() <= now.getTime()) throw new UnauthorizedError('Sesión expirada');

    const user = await this.usuarios.findById(stored.userId);
    if (!user || !user.activo || !user.perfil) {
      await this.sesiones.revokeFamily(stored.familia, now);
      throw new UnauthorizedError('Sesión inválida');
    }

    return this.session.rotate(user, stored.id, stored.familia);
  }

  private hashMatches(expected: string, token: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(this.tokens.fingerprint(token));
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
