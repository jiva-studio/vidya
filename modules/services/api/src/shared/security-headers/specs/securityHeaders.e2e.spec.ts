import { INestApplication } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createTestingApp } from '@vidya/api/edu/shared'
import { securityHeaders } from '@vidya/api/shared/security-headers'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

// An open route: these headers belong to every answer, guarded or not.
const OPEN = Routes().otp.root()

describe('the headers every response leaves the API with', () => {
  let app: INestApplication

  afterEach(async () => {
    await app.close()
  })

  it('refuses MIME sniffing, framing and a leaked referrer, with HSTS off by default', async () => {
    app = await createTestingApp([], (nest: NestExpressApplication) =>
      nest.use(securityHeaders({ hstsEnabled: false })),
    )

    const response = await request(app.getHttpServer()).post(OPEN).send({})

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['referrer-policy']).toBeTruthy()
    expect(response.headers['strict-transport-security']).toBeUndefined()
  })

  it('leaves a JSON API without a document policy that has nothing to police', async () => {
    app = await createTestingApp([], (nest: NestExpressApplication) =>
      nest.use(securityHeaders({ hstsEnabled: false })),
    )

    const response = await request(app.getHttpServer()).post(OPEN).send({})

    expect(response.headers['content-security-policy']).toBeUndefined()
  })

  it('sends HSTS only once a deployment says TLS terminates in front of it', async () => {
    app = await createTestingApp([], (nest: NestExpressApplication) =>
      nest.use(securityHeaders({ hstsEnabled: true })),
    )

    const response = await request(app.getHttpServer()).post(OPEN).send({})

    expect(response.headers['strict-transport-security']).toContain('max-age=')
  })
})
