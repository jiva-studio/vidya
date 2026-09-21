import { randomUUID } from 'node:crypto'

import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { LoggerService } from './logger.service'

export interface RequestWithId extends Request {
  id?: string
  startTime?: number
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP')
  }

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const rawId = req.headers['x-request-id']
    const requestId = (typeof rawId === 'string' && rawId.trim()) || randomUUID()
    const startTime = Date.now()

    req.id = requestId
    req.startTime = startTime
    res.setHeader('x-request-id', requestId)

    res.on('finish', () => {
      const durationMs = Date.now() - startTime
      const statusCode = res.statusCode
      const method = req.method
      const url = req.originalUrl || req.url
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      const userAgent = req.headers['user-agent'] || 'unknown'
      const contentLength = res.getHeader('content-length') || 0

      const meta = {
        requestId,
        method,
        url,
        statusCode,
        durationMs,
        ip,
        userAgent,
        contentLength,
      }

      const logMsg = `${method} ${url} ${statusCode} ${durationMs}ms - ${ip}`

      if (statusCode >= 500) {
        this.logger.error(logMsg, undefined, 'HTTP', meta)
      } else if (statusCode >= 400) {
        this.logger.warn(logMsg, 'HTTP', meta)
      } else {
        this.logger.log(logMsg, 'HTTP', meta)
      }
    })

    next()
  }
}
