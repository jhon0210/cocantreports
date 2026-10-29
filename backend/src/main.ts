import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApplication } from './bootstrap';
import { AppConfig } from './infrastructure/config/app.config';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  app.enableShutdownHooks();

  const port = app.get(ConfigService<AppConfig, true>).get('port', { infer: true });
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}  |  Swagger: http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
