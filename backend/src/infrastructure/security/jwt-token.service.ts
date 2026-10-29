import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  RefreshTokenClaims,
  TokenService,
} from '../../application/ports/token-service.port';
import { UnauthorizedError } from '../../domain/shared/domain-errors';
import { AppConfig } from '../config/app.config';

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

@Injectable()
export class JwtTokenService implements TokenService {
  readonly refreshTtlMs: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresInSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    const jwtConfig = config.get('jwt', { infer: true });
    this.accessSecret = jwtConfig.accessSecret;
    this.refreshSecret = jwtConfig.refreshSecret;
    this.accessExpiresInSeconds = durationToSeconds(jwtConfig.accessExpiresIn);
    this.refreshTtlMs = jwtConfig.refreshExpiresDays * 86_400_000;
  }

  async signAccessToken(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }> {
    const token = await this.jwt.signAsync(
      { sub: String(payload.sub), usuario: payload.usuario, perfil: payload.perfil, typ: 'access' },
      { secret: this.accessSecret, algorithm: 'HS256', expiresIn: this.accessExpiresInSeconds },
    );
    return { token, expiresIn: this.accessExpiresInSeconds };
  }

  signRefreshToken(claims: RefreshTokenClaims, expiresAt: Date): Promise<string> {
    const seconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    return this.jwt.signAsync(
      { sub: String(claims.sub), jti: claims.jti, fam: claims.fam, typ: 'refresh' },
      { secret: this.refreshSecret, algorithm: 'HS256', expiresIn: seconds },
    );
  }

  async verifyRefreshToken(token: string, options?: { ignoreExpiration?: boolean }): Promise<RefreshTokenClaims> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; jti: string; fam: string; typ: string }>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
        ignoreExpiration: options?.ignoreExpiration ?? false,
      });
      const sub = Number(payload.sub);
      if (payload.typ !== 'refresh' || !Number.isInteger(sub) || !payload.jti || !payload.fam) {
        throw new Error('claims inválidos');
      }
      return { sub, jti: payload.jti, fam: payload.fam };
    } catch {
      throw new UnauthorizedError('Sesión inválida');
    }
  }

  fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
