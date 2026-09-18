import { Entities } from '@vidya/entities'
import { DataSource } from 'typeorm'

export const MainDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'postgres',
  logging: true,
  entities: Entities,
  migrations: ['./dist/services/database/migrations/**/*.js'],
})
