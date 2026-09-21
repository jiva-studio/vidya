import { registerAs } from '@nestjs/config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'json' | 'pretty'

export default registerAs('logging', () => {
  const isProd = process.env.NODE_ENV === 'production'
  const level = (process.env.VIDYA_LOG_LEVEL || (isProd ? 'info' : 'debug')) as LogLevel
  const format = (process.env.VIDYA_LOG_FORMAT || (isProd ? 'json' : 'pretty')) as LogFormat

  return {
    level,
    format,
  }
})
