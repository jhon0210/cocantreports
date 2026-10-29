import { Body, Controller, Get, Post, Req, Res, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { IsString } from 'class-validator';
import { Request, Response } from 'express';
import { configureApp } from './app.setup';
import { RefreshCookieService } from './presentation/auth/refresh-cookie.service';

const mockCreateApplication = jest.fn();
jest.mock('./bootstrap', () => ({ createApplication: () => mockCreateApplication() }));

class TestBody {
  @IsString()
  nombre: string;
}

@Controller('adapter-test')
class AdapterTestController {
  constructor(private readonly cookies: RefreshCookieService) {}

  @Get()
  get() {
    return { ok: true };
  }

  @Post()
  post(@Body() body: TestBody) {
    return body;
  }

  @Get('cookie')
  cookie(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.cookies.set(res, 'synthetic-refresh', new Date('2030-01-01'));
    return { received: req.cookies.refresh_token };
  }

  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.cookies.clear(res);
    return { ok: true };
  }

  @Get('pdf')
  pdf() {
    return new StreamableFile(Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0, 128, 255]), Buffer.from('\n%%EOF')]), { type: 'application/pdf' });
  }
}

function event(path = '/adapter-test', method = 'GET'): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'api.example.test', origin: 'https://app.example.test' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'api.example.test',
      domainPrefix: 'api',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'synthetic' },
      requestId: 'test',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  };
}

function context(): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'test',
    memoryLimitInMB: '512',
    awsRequestId: 'test',
    logGroupName: 'test',
    logStreamName: 'test',
    getRemainingTimeInMillis: () => 10_000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };
}

describe('Lambda HTTP API v2 adapter (sin BD ni puertos)', () => {
  let app: NestExpressApplication;
  let handler: typeof import('./lambda').handler;

  beforeEach(async () => {
    const config = new ConfigService({
      corsOrigins: ['https://app.example.test'],
      cookie: { sameSite: 'strict', secure: true, path: '/auth' },
    });
    const module = await Test.createTestingModule({
      controllers: [AdapterTestController],
      providers: [RefreshCookieService, { provide: ConfigService, useValue: config }],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    mockCreateApplication.mockReset().mockResolvedValue(app);
    jest.isolateModules(() => {
      const lambda: typeof import('./lambda') = require('./lambda');
      handler = lambda.handler;
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('inicializa una sola aplicación incluso con primeras invocaciones concurrentes', async () => {
    const init = jest.spyOn(app, 'init');
    const ctx = context();
    const results = await Promise.all([
      handler(event(), ctx, jest.fn()),
      handler(event(), context(), jest.fn()),
    ]);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ statusCode: 200, body: '{"ok":true}' }),
    ]));
    expect(results.every((result) => result?.statusCode === 200)).toBe(true);
    await handler(event(), context(), jest.fn());
    expect(mockCreateApplication).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('preserva cookies entrantes y Set-Cookie con atributos de seguridad', async () => {
    const input = { ...event('/adapter-test/cookie'), cookies: ['refresh_token=synthetic-input'] };
    const result = await handler(input, context(), jest.fn());
    expect(result?.body).toBe('{"received":"synthetic-input"}');
    expect(result?.cookies).toEqual([expect.stringMatching(/^refresh_token=synthetic-refresh;/)]);
    expect(result?.cookies?.[0]).toContain('HttpOnly');
    expect(result?.cookies?.[0]).toContain('Secure');
    expect(result?.cookies?.[0]).toContain('SameSite=Strict');
    expect(result?.cookies?.[0]).toContain('Path=/auth');
    expect(result?.headers?.['access-control-allow-origin']).toBe('https://app.example.test');
    expect(result?.headers?.['access-control-allow-credentials']).toBe('true');
  });

  it('preserva la expiración de la cookie al cerrar sesión', async () => {
    const result = await handler(event('/adapter-test/logout'), context(), jest.fn());
    expect(result?.cookies?.[0]).toContain('refresh_token=;');
    expect(result?.cookies?.[0]).toContain('Expires=Thu, 01 Jan 1970');
    expect(result?.cookies?.[0]).toContain('Path=/auth');
  });

  it('mantiene validaciones y no devuelve errores internos del adaptador', async () => {
    const input = { ...event('/adapter-test', 'POST'), body: '{"nombre":42}', headers: { ...event().headers, 'content-type': 'application/json' } };
    const result = await handler(input, context(), jest.fn());
    expect(result?.statusCode).toBe(400);
    expect(result?.body).toContain('nombre');
    expect(result?.body).not.toContain('stack');
    input.body = '{"nombre":"Sintético"}';
    const valid = await handler(input, context(), jest.fn());
    expect(valid?.statusCode).toBe(201);
    expect(valid?.body).toBe(input.body);
  });

  it('responde al preflight CORS sin abrir puertos', async () => {
    const input = event('/adapter-test', 'OPTIONS');
    input.headers['access-control-request-method'] = 'POST';
    const result = await handler(input, context(), jest.fn());
    expect(result?.statusCode).toBe(204);
    expect(result?.headers?.['access-control-allow-origin']).toBe('https://app.example.test');
  });

  it('preserva respuestas binarias existentes', async () => {
    const result = await handler(event('/adapter-test/pdf'), context(), jest.fn());
    expect(result?.statusCode).toBe(200);
    expect(result?.isBase64Encoded).toBe(true);
    expect(Buffer.from(result?.body ?? '', 'base64')).toEqual(Buffer.concat([
      Buffer.from('%PDF-1.7\n'), Buffer.from([0, 128, 255]), Buffer.from('\n%%EOF'),
    ]));
  });

  it('propaga errores de arranque y permite reintentar sin una caché fallida', async () => {
    mockCreateApplication.mockRejectedValueOnce(new Error('synthetic bootstrap failure'));
    await expect(handler(event(), context(), jest.fn())).rejects.toThrow('synthetic bootstrap failure');
    const result = await handler(event(), context(), jest.fn());
    expect(result?.statusCode).toBe(200);
    expect(mockCreateApplication).toHaveBeenCalledTimes(2);
  });

  it('cierra una aplicación cuya inicialización falló', async () => {
    jest.spyOn(app, 'init').mockRejectedValueOnce(new Error('synthetic init failure'));
    const close = jest.spyOn(app, 'close');
    await expect(handler(event(), context(), jest.fn())).rejects.toThrow('synthetic init failure');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
