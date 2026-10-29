import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  afterEach(() => jest.restoreAllMocks());

  function executionContext(): ExecutionContext {
    const request = {
      method: 'GET',
      originalUrl: '/recuperadores/cedula/123456789?token=synthetic-secret',
      route: { path: '/recuperadores/cedula/:cedula' },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;
  }

  it('registra la plantilla de ruta, no identificaciones ni parámetros de consulta', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await lastValueFrom(new LoggingInterceptor().intercept(executionContext(), next));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('/recuperadores/cedula/:cedula'));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456789|synthetic-secret/);
  });

  it('no filtra la URL ni el contenido de errores', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = new Error('synthetic-private-content');
    const next: CallHandler = { handle: () => throwError(() => error) };
    await expect(lastValueFrom(new LoggingInterceptor().intercept(executionContext(), next))).rejects.toBe(error);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('/recuperadores/cedula/:cedula'));
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/123456789|synthetic-secret|synthetic-private-content/);
  });
});
