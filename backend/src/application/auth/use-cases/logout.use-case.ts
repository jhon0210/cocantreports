import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_SESSION_REPOSITORY, RefreshSessionRepository } from '../../../domain/auth/refresh-session.repository';
import { CLOCK, Clock } from '../../ports/clock.port';
import { TOKEN_SERVICE, TokenService } from '../../ports/token-service.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sesiones: RefreshSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Idempotente: si el token no es válido simplemente no hay nada que revocar. */
  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const claims = await this.tokens.verifyRefreshToken(refreshToken, { ignoreExpiration: true });
      const stored = await this.sesiones.findById(claims.jti);
      if (stored) await this.sesiones.revokeFamily(stored.familia, this.clock.now());
    } catch {
      // token malformado o con firma inválida: se ignora
    }
  }
}
