import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { AppConfig } from '../../infrastructure/config/app.config';

export const REFRESH_COOKIE = 'refresh_token';

/** Gestiona la cookie HttpOnly del refresh token (inaccesible desde JavaScript). */
@Injectable()
export class RefreshCookieService {
  private readonly base: CookieOptions;

  constructor(config: ConfigService<AppConfig, true>) {
    const { sameSite, secure, path } = config.get('cookie', { infer: true });
    this.base = { httpOnly: true, secure, sameSite, path };
  }

  set(res: Response, token: string, expires: Date): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.base, expires });
  }

  clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.base);
  }
}
