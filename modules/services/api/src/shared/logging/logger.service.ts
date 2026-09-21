import { Injectable, LoggerService as NestLoggerService, Optional, Scope } from '@nestjs/common'
import * as Sentry from '@sentry/node'

import type { LogFormat, LogLevel } from '../../configs/logging.config'

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface LoggerOptions {
  level?: LogLevel
  format?: LogFormat
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string
  private readonly level: LogLevel
  private readonly format: LogFormat

  constructor(@Optional() options?: LoggerOptions) {
    this.level = options?.level ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    this.format = options?.format ?? (process.env.NODE_ENV === 'production' ? 'json' : 'pretty')
  }

  setContext(context: string): this {
    this.context = context
    return this
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams)
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams)
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams)
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams)
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams)
  }

  private write(level: LogLevel, rawMessage: unknown, optionalParams: unknown[]): void {
    if (LOG_LEVEL_WEIGHTS[level] < LOG_LEVEL_WEIGHTS[this.level]) {
      return
    }

    const { message, context, stack, extra } = this.parseParams(rawMessage, optionalParams)
    const timestamp = new Date().toISOString()
    const activeSpan = Sentry.getActiveSpan?.()
    const spanContext = activeSpan?.spanContext?.()
    const traceId = spanContext?.traceId
    const spanId = spanContext?.spanId

    if (this.format === 'json') {
      const payload: Record<string, unknown> = {
        timestamp,
        level,
        context: context || this.context || 'Application',
        message,
        ...(traceId ? { trace_id: traceId, span_id: spanId } : {}),
        ...(stack ? { stack } : {}),
        ...extra,
      }
      const line = this.safeStringify(payload) + '\n'
      if (level === 'error') {
        process.stderr.write(line)
      } else {
        process.stdout.write(line)
      }
    } else {
      const ctxStr = context || this.context ? `[${context || this.context}] ` : ''
      const stackStr = stack ? `\n${stack}` : ''
      const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : ''
      const line = `[${timestamp}] [${level.toUpperCase()}] ${ctxStr}${message}${extraStr}${stackStr}\n`
      if (level === 'error') {
        process.stderr.write(line)
      } else {
        process.stdout.write(line)
      }
    }
  }

  private parseParams(rawMessage: unknown, optionalParams: unknown[]) {
    let message = typeof rawMessage === 'string' ? rawMessage : this.safeStringify(rawMessage)
    let context = this.context
    let stack: string | undefined
    let extra: Record<string, unknown> = {}

    if (rawMessage instanceof Error) {
      message = rawMessage.message
      stack = rawMessage.stack
    }

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        if (!stack && (param.includes('\n') || param.includes('Error:'))) {
          stack = param
        } else {
          context = param
        }
      } else if (param instanceof Error) {
        stack = param.stack
      } else if (typeof param === 'object' && param !== null) {
        extra = { ...extra, ...(param as Record<string, unknown>) }
      }
    }

    return { message, context, stack, extra }
  }

  private safeStringify(obj: unknown): string {
    const seen = new WeakSet()
    try {
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]'
          }
          seen.add(value)
        }
        return value
      })
    } catch {
      return String(obj)
    }
  }
}
