import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as request from 'supertest'

import { isProductionEnvironment, setupSwagger } from '../setup'

describe('isProductionEnvironment', () => {
  it('treats "production" as production', () => {
    expect(isProductionEnvironment('production')).toBe(true)
  })

  it('treats every other value as not production', () => {
    expect(isProductionEnvironment('development')).toBe(false)
    expect(isProductionEnvironment('test')).toBe(false)
    expect(isProductionEnvironment(undefined)).toBe(false)
  })
})

describe('setupSwagger', () => {
  let app: INestApplication

  afterEach(async () => {
    await app.close()
  })

  it('does not serve /swagger in production', async () => {
    app = await createTestingApp([], (nestApp) => setupSwagger(nestApp, 'production'))

    return request(app.getHttpServer()).get('/swagger').expect(404)
  })

  it('serves /swagger outside production', async () => {
    app = await createTestingApp([], (nestApp) => setupSwagger(nestApp, 'development'))

    return request(app.getHttpServer()).get('/swagger').expect(200)
  })
})
