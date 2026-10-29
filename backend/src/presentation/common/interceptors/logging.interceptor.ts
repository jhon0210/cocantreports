import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Registra método, ruta, estado y duración. No registra cuerpos (podrían contener claves). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const route: unknown = request.route?.path;
    const path = typeof route === 'string' ? route : '[ruta no identificada]';
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${request.method} ${path} ${http.getResponse<Response>().statusCode} ${Date.now() - started}ms`),
        error: () => this.logger.warn(`${request.method} ${path} falló en ${Date.now() - started}ms`),
      }),
    );
  }
}
