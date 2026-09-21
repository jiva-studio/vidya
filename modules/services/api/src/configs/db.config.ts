import { registerAs } from '@nestjs/config'

export default registerAs('db', () => ({
  type: (process.env.VIDYA_DB_TYPE || 'postgres') as 'postgres' | 'mysql',
  host: process.env.VIDYA_DB_HOST || 'localhost',
  port: parseInt(process.env.VIDYA_DB_PORT, 10) || 5432,
  username: process.env.VIDYA_DB_USERNAME || 'postgres',
  password: process.env.VIDYA_DB_PASSWORD || 'postgres',
  database: process.env.VIDYA_DB_DATABASE || 'postgres',
  schema: process.env.VIDYA_DB_SCHEMA || 'public',
  // Off by default: TypeORM's query log includes bound parameters, so an
  // unset variable would otherwise ship every email, name, and homework
  // answer that passes through a query into the application log. Dev turns
  // it on explicitly (see modules/Makefile).
  logging: process.env.VIDYA_DB_LOGGING === 'true',
  poolSize: parseInt(process.env.VIDYA_DB_POOL_MAX, 10) || 20,
  minPoolSize: parseInt(process.env.VIDYA_DB_POOL_MIN, 10) || 2,
  idleTimeoutMillis: parseInt(process.env.VIDYA_DB_IDLE_TIMEOUT_MS, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.VIDYA_DB_CONNECTION_TIMEOUT_MS, 10) || 5000,
  ssl:
    process.env.VIDYA_DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.VIDYA_DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
}))
