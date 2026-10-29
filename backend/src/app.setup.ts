import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppConfig } from './infrastructure/config/app.config';
import { HttpExceptionFilter } from './presentation/common/filters/http-exception.filter';

/** Configuración común a main.ts y a los tests e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<AppConfig, true>);

  const strictHelmet = helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } });
  const swaggerHelmet = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith('/api/docs') ? swaggerHelmet : strictHelmet)(req, res, next),
  );

  app.use(cookieParser());
  // Solo ECA recibe hasta 5 PDF de 2 MB codificados en base64.
  app.use('/ecas', json({ limit: '15mb' }));
  // Foto y hasta tres documentos escaneados de 1 MB en base64.
  app.use('/recuperadores', json({ limit: '8mb' }));
  // Nest detecta el parser anterior y no instala su parser general automáticamente.
  app.use(json({ limit: '2mb' }));
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API de Reportes de Ventas de Material de Aprovechamiento')
      .setDescription(
        'Autenticación JWT: POST /auth/login devuelve el access_token (úsalo con "Authorize") y deja el refresh token en una cookie HttpOnly.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie', name: 'refresh_token' }, 'refresh_token')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}
