import { ConfigService } from '@nestjs/config';
import express from 'express';
import { appConfig, AppConfig } from '../../infrastructure/config/app.config';
import { RefreshCookieService } from './refresh-cookie.service';

describe('RefreshCookieService', () => {
  it.each(['/auth', '/api/auth'])('usa el mismo path %s al crear y borrar la cookie', (path) => {
    const config = new ConfigService<AppConfig, true>({
      ...appConfig(),
      cookie: { path, secure: true, sameSite: 'strict' as const },
    });
    const service = new RefreshCookieService(config);
    const res = express().response;
    jest.spyOn(res, 'cookie').mockReturnValue(res);
    jest.spyOn(res, 'clearCookie').mockReturnValue(res);
    service.set(res, 'synthetic', new Date('2030-01-01'));
    service.clear(res);
    const expected = { path, secure: true, sameSite: 'strict', httpOnly: true };
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'synthetic', {
      ...expected, expires: new Date('2030-01-01'),
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expected);
  });
});
