import { Injectable, OnModuleInit, Optional } from '@nestjs/common'
import * as Sentry from '@sentry/node'

export interface SentryOptions {
  dsn?: string
  environment?: string
  release?: string
  tracesSampleRate?: number
  enabled?: boolean
}

export interface SentryCaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  user?: Sentry.User
}

const getTracesSampleRate = (): number => {
  if (process.env.VIDYA_SENTRY_TRACES_SAMPLE_RATE) {
    return Number.parseFloat(process.env.VIDYA_SENTRY_TRACES_SAMPLE_RATE)
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
}

const getDefaultSentryOptions = (): SentryOptions => {
  const dsn = process.env.VIDYA_SENTRY_DSN || process.env.SENTRY_DSN
  const environment = process.env.VIDYA_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
  const release = process.env.VIDYA_SENTRY_RELEASE || process.env.npm_package_version || '0.0.1'

  return {
    dsn,
    environment,
    release,
    tracesSampleRate: getTracesSampleRate(),
    enabled: Boolean(dsn),
  }
}

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly enabled: boolean
  private readonly options: SentryOptions

  constructor(@Optional() options?: SentryOptions) {
    this.options = options ?? getDefaultSentryOptions()
    this.enabled = Boolean(this.options.dsn && this.options.enabled !== false)
  }

  onModuleInit(): void {
    if (!this.enabled || !this.options.dsn) {
      return
    }

    Sentry.init({
      dsn: this.options.dsn,
      environment: this.options.environment,
      release: this.options.release,
      tracesSampleRate: this.options.tracesSampleRate,
    })
  }

  isEnabled(): boolean {
    return this.enabled
  }

  captureException(error: unknown, context?: SentryCaptureContext): string | undefined {
    if (!this.enabled) {
      return undefined
    }

    return Sentry.captureException(error, (scope) => {
      if (context?.tags) {
        scope.setTags(context.tags)
      }
      if (context?.extra) {
        scope.setExtras(context.extra)
      }
      if (context?.user) {
        scope.setUser(context.user)
      }
      return scope
    })
  }

  setUser(user: Sentry.User | null): void {
    if (!this.enabled) return
    Sentry.setUser(user)
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.enabled) return
    Sentry.addBreadcrumb(breadcrumb)
  }
}
