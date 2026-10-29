import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../domain/shared/domain-errors';

interface ErrorPayload {
  status: number;
  message: string | string[];
  error: string;
}

const DOMAIN_STATUS: Array<[new (...args: never[]) => DomainError, number]> = [
  [ValidationError, HttpStatus.BAD_REQUEST],
  [UnauthorizedError, HttpStatus.UNAUTHORIZED],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [BusinessRuleError, HttpStatus.UNPROCESSABLE_ENTITY],
];

/** Traduce errores de dominio, de Prisma y HTTP a una respuesta JSON uniforme. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const payload = this.toPayload(exception);
    if (payload.status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(payload.status).json({
      statusCode: payload.status,
      error: payload.error,
      message: payload.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private toPayload(exception: unknown): ErrorPayload {
    if (exception instanceof DomainError) {
      const status = DOMAIN_STATUS.find(([type]) => exception instanceof type)?.[1] ?? HttpStatus.BAD_REQUEST;
      return { status, message: exception.message, error: HttpStatus[status] };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      return { status, message, error: HttpStatus[status] ?? 'Error' };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con esos datos únicos', error: 'CONFLICT' };
        case 'P2003':
          return { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Referencia a un registro inexistente o en uso', error: 'UNPROCESSABLE_ENTITY' };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Registro no encontrado', error: 'NOT_FOUND' };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor', error: 'INTERNAL_SERVER_ERROR' };
  }
}
