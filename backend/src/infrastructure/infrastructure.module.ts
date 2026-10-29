import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CLOCK } from '../application/ports/clock.port';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { TOKEN_SERVICE } from '../application/ports/token-service.port';
import { BcryptPasswordHasher } from './security/bcrypt-password-hasher';
import { JwtTokenService } from './security/jwt-token.service';
import { SystemClock } from './time/system-clock';

/** Adaptadores de los puertos de la capa de aplicación (hashing, JWT, reloj). */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [PASSWORD_HASHER, TOKEN_SERVICE, CLOCK],
})
export class InfrastructureModule {}
