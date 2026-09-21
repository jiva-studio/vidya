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

const safeStringify = (obj: unknown): string => {
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

interface ParsedLogParams {
  level: LogLevel
  message: string
  context?: string
  stack?: string
  extra: Record<string, unknown>
}

const parseSingleParam = (
  param: unknown,
  state: { context?: string; stack?: string; extra: Record<string, unknown> },
) => {
  if (typeof param === 'string') {
    if (!state.stack && (param.includes('\n') || param.includes('Error:'))) {
      state.stack = param
    } else {
      state.context = param
    }
  } else if (param instanceof Error) {
    state.stack = param.stack
  } else if (typeof param === 'object' && param !== null) {
    state.extra = { ...state.extra, ...(param as Record<string, unknown>) }
  }
}

const parseParams = (
  level: LogLevel,
  rawMessage: unknown,
  optionalParams: unknown[],
  defaultContext?: string,
): ParsedLogParams => {
  let message = typeof rawMessage === 'string' ? rawMessage : safeStringify(rawMessage)
  let stack: string | undefined

  if (rawMessage instanceof Error) {
    message = rawMessage.message
    stack = rawMessage.stack
  }

  const state = { context: defaultContext, stack, extra: {} }
  for (const param of optionalParams) {
    parseSingleParam(param, state)
  }

  return {
    level,
    message,
    context: state.context,
    stack: state.stack,
    extra: state.extra,
  }
}

const formatJsonLine = (params: ParsedLogParams, defaultContext?: string): string => {
  const activeSpan = Sentry.getActiveSpan?.()
  const spanContext = activeSpan?.spanContext?.()
  const traceId = spanContext?.traceId
  const spanId = spanContext?.spanId

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: params.level,
    context: params.context || defaultContext || 'Application',
    message: params.message,
    ...(traceId ? { trace_id: traceId, span_id: spanId } : {}),
    ...(params.stack ? { stack: params.stack } : {}),
    ...params.extra,
  }
  return safeStringify(payload) + '\n'
}

const formatPrettyLine = (params: ParsedLogParams, defaultContext?: string): string => {
  const timestamp = new Date().toISOString()
  const ctx = params.context || defaultContext
  const ctxStr = ctx ? `[${ctx}] ` : ''
  const stackStr = params.stack ? `\n${params.stack}` : ''
  const extraKeys = Object.keys(params.extra)
  const extraStr = extraKeys.length > 0 ? ` ${JSON.stringify(params.extra)}` : ''
  return `[${timestamp}] [${params.level.toUpperCase()}] ${ctxStr}${params.message}${extraStr}${stackStr}\n`
}

const emitLog = (level: LogLevel, line: string): void => {
  if (level === 'error') {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
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

    const params = parseParams(level, rawMessage, optionalParams, this.context)
    const line =
      this.format === 'json'
        ? formatJsonLine(params, this.context)
        : formatPrettyLine(params, this.context)

    emitLog(level, line)
  }
}
