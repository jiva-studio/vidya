import { registerAs } from '@nestjs/config'

const getTracesSampleRate = (): number => {
  if (process.env.VIDYA_SENTRY_TRACES_SAMPLE_RATE) {
    return Number.parseFloat(process.env.VIDYA_SENTRY_TRACES_SAMPLE_RATE)
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
}

export default registerAs('sentry', () => {
  const dsn = process.env.VIDYA_SENTRY_DSN || process.env.SENTRY_DSN || ''
  const environment = process.env.VIDYA_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
  const release = process.env.VIDYA_SENTRY_RELEASE || process.env.npm_package_version || '0.0.1'

  return {
    dsn,
    environment,
    release,
    tracesSampleRate: getTracesSampleRate(),
    enabled: Boolean(dsn),
  }
})
