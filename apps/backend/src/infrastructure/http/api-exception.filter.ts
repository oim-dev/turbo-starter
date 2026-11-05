import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

const errorCode = (status: number) =>
  ({
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    415: 'UNSUPPORTED_MEDIA_TYPE',
    429: 'RATE_LIMITED',
    503: 'SERVICE_UNAVAILABLE',
  })[status] ?? 'INTERNAL_ERROR';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'object' ? (body as Record<string, unknown>) : {};
      response.status(status).json({
        statusCode: status,
        code: typeof detail.code === 'string' ? detail.code : errorCode(status),
        message:
          typeof body === 'string'
            ? body
            : (detail.message ?? exception.message),
      });
      return;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        exception.code === 'P2025'
          ? 404
          : ['P2002', 'P2003', 'P2034'].includes(exception.code)
            ? 409
            : undefined;
      if (status) {
        response
          .status(status)
          .json({
            statusCode: status,
            code: errorCode(status),
            message:
              status === 404
                ? 'Ресурс не найден.'
                : 'Данные изменились или конфликтуют с существующими. Обновите данные.',
          });
        return;
      }
    }
    const parserErrors: Record<
      string,
      { statusCode: number; message: string }
    > = {
      'entity.too.large': {
        statusCode: 413,
        message: 'Request body is too large',
      },
      'entity.parse.failed': { statusCode: 400, message: 'Invalid JSON body' },
      'request.size.invalid': {
        statusCode: 400,
        message: 'Invalid request size',
      },
      'charset.unsupported': {
        statusCode: 415,
        message: 'Unsupported charset',
      },
      'encoding.unsupported': {
        statusCode: 415,
        message: 'Unsupported content encoding',
      },
    };
    if (
      exception &&
      typeof exception === 'object' &&
      'type' in exception &&
      typeof exception.type === 'string'
    ) {
      const error = Object.hasOwn(parserErrors, exception.type)
        ? parserErrors[exception.type]
        : undefined;
      if (error) {
        response
          .status(error.statusCode)
          .json({ ...error, code: errorCode(error.statusCode) });
        return;
      }
    }
    // Не записываем в журнал тела запросов, cookie, токены и подробности ошибок базы данных.
    this.logger.error(
      `Unhandled request error: ${exception instanceof Error ? exception.name : 'unknown'}`,
    );
    response
      .status(500)
      .json({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
  }
}
