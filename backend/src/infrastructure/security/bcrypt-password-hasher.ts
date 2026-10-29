import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PasswordHasher } from '../../application/ports/password-hasher.port';
import { AppConfig } from '../config/app.config';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.rounds = config.get('bcryptRounds', { infer: true });
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
