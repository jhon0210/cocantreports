import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { GetAuthenticatedUserUseCase } from '../../application/auth/use-cases/get-authenticated-user.use-case';
import { AppConfig } from '../../infrastructure/config/app.config';

interface AccessTokenClaims {
  sub: string;
  typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly getAuthenticatedUser: GetAuthenticatedUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessTokenClaims): Promise<AuthenticatedUser | false> {
    const id = Number(payload.sub);
    if (payload.typ !== 'access' || !Number.isInteger(id)) return false;
    try {
      return await this.getAuthenticatedUser.execute(id);
    } catch {
      return false;
    }
  }
}
