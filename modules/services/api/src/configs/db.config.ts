import { registerAs } from '@nestjs/config'

const parseNumber = (val: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(val ?? '', 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const getSslConfig = (sslEnv: string | undefined, rejectEnv: string | undefined) => {
  if (sslEnv !== 'true') return false
  return { rejectUnauthorized: rejectEnv !== 'false' }
}

export default registerAs('db', () => ({
  type: (process.env.VIDYA_DB_TYPE || 'postgres') as 'postgres' | 'mysql',
  host: process.env.VIDYA_DB_HOST || 'localhost',
  port: parseNumber(process.env.VIDYA_DB_PORT, 5432),
  username: process.env.VIDYA_DB_USERNAME || 'postgres',
  password: process.env.VIDYA_DB_PASSWORD || 'postgres',
  database: process.env.VIDYA_DB_DATABASE || 'postgres',
  schema: process.env.VIDYA_DB_SCHEMA || 'public',
  // Off by default: TypeORM's query log includes bound parameters, so an
  // unset variable would otherwise ship every email, name, and homework
  // answer that passes through a query into the application log. Dev turns
  // it on explicitly (see modules/Makefile).
  logging: process.env.VIDYA_DB_LOGGING === 'true',
  poolSize: parseNumber(process.env.VIDYA_DB_POOL_MAX, 20),
  minPoolSize: parseNumber(process.env.VIDYA_DB_POOL_MIN, 2),
  idleTimeoutMillis: parseNumber(process.env.VIDYA_DB_IDLE_TIMEOUT_MS, 30000),
  connectionTimeoutMillis: parseNumber(process.env.VIDYA_DB_CONNECTION_TIMEOUT_MS, 5000),
  ssl: getSslConfig(process.env.VIDYA_DB_SSL, process.env.VIDYA_DB_SSL_REJECT_UNAUTHORIZED),
}))
