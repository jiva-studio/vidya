import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { LoggerService } from '../logging/logger.service'
import { SentryService } from './sentry.service'

interface RequestWithUser extends Request {
  user?: {
    id?: string
    email?: string
    schoolId?: string
    role?: string
  }
  id?: string
}

@Catch()
@Injectable()
export class SentryExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly sentryService: SentryService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('Exceptions')
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<RequestWithUser>()

    const isHttpException = exception instanceof HttpException
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const method = request.method || 'UNKNOWN'
    const url = request.url || '/'
    const requestId = request.id

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Capture 5xx in Sentry
      this.sentryService.captureException(exception, {
        tags: {
          method,
          route: url,
          statusCode: String(status),
        },
        extra: {
          requestId,
          ip: request.ip,
          userAgent: request.headers?.['user-agent'],
        },
        user: request.user
          ? {
              id: request.user.id,
              email: request.user.email,
              schoolId: request.user.schoolId,
            }
          : undefined,
      })

      const message = exception instanceof Error ? exception.message : 'Unknown internal error'
      const stack = exception instanceof Error ? exception.stack : undefined

      this.logger.error(`Unhandled error [${method} ${url}]: ${message}`, stack, 'Exceptions', {
        requestId,
        status,
      })

      response.status(status).json({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      })
      return
    }

    // Client errors (4xx)
    const errorResponse = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Request failed' }

    if (typeof errorResponse === 'object' && errorResponse !== null) {
      response.status(status).json(errorResponse)
    } else {
      response.status(status).json({
        statusCode: status,
        message: errorResponse,
      })
    }
  }
}
