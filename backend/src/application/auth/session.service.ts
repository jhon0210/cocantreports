import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_SESSION_REPOSITORY, RefreshSessionRepository } from '../../domain/auth/refresh-session.repository';
import { UnauthorizedError } from '../../domain/shared/domain-errors';
import { Usuario } from '../../domain/usuarios/usuario.entity';
import { CLOCK, Clock } from '../ports/clock.port';
import { TOKEN_SERVICE, TokenService } from '../ports/token-service.port';

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: Usuario;
}

/** Emite pares access/refresh y persiste la sesión de refresh (solo su hash). */
@Injectable()
export class SessionService {
  constructor(
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sesiones: RefreshSessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Nueva familia (login). */
  async open(user: Usuario): Promise<AuthSession> {
    const sesion = await this.buildTokens(user, randomUUID(), randomUUID());
    await this.sesiones.create(sesion.record);
    return sesion.result;
  }

  /** Misma familia, token nuevo; revoca el anterior de forma atómica. */
  async rotate(user: Usuario, currentId: string, familia: string): Promise<AuthSession> {
    const sesion = await this.buildTokens(user, familia, randomUUID());
    const ok = await this.sesiones.rotate(currentId, sesion.record, this.clock.now());
    if (!ok) throw new UnauthorizedError('Sesión inválida');
    return sesion.result;
  }

  private async buildTokens(user: Usuario, familia: string, id: string) {
    const expiresAt = new Date(this.clock.now().getTime() + this.tokens.refreshTtlMs);
    const access = await this.tokens.signAccessToken({ sub: user.id, usuario: user.usuario, perfil: user.perfil! });
    const refreshToken = await this.tokens.signRefreshToken({ sub: user.id, jti: id, fam: familia }, expiresAt);
    return {
      record: { id, familia, userId: user.id, tokenHash: this.tokens.fingerprint(refreshToken), expiresAt },
      result: { accessToken: access.token, expiresIn: access.expiresIn, refreshToken, refreshExpiresAt: expiresAt, user },
    };
  }
}
