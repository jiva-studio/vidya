import { INestApplication } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createTestingApp } from '@vidya/api/edu/shared'
import { corsOptionsFor } from '@vidya/api/shared/cors'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

const ALLOWED = 'http://localhost:7811'
const NATIVE = 'capacitor://localhost'
const STRANGER = 'https://school-of-phishing.example'

// A guarded route on purpose: the preflight must be answered without a token,
// and this is where a guard would otherwise refuse it.
const GUARDED = Routes().sync.pull()
const OPEN = Routes().otp.root()

describe('who may read an answer from this API', () => {
  let app: INestApplication

  beforeEach(async () => {
    app = await createTestingApp([], (nest: NestExpressApplication) =>
      nest.enableCors(corsOptionsFor([ALLOWED, NATIVE])),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  const preflight = (path: string, origin: string) =>
    request(app.getHttpServer())
      .options(path)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')

  it('answers the preflight of a guarded route without a token', async () => {
    const response = await preflight(GUARDED, ALLOWED)

    expect(response.status).toBeLessThan(300)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED)
  })

  it('names the methods and the headers the clients actually use', async () => {
    const response = await preflight(GUARDED, ALLOWED)

    expect(response.headers['access-control-allow-methods']).toContain('POST')
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain(
      'authorization',
    )
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  /**
   * Capacitor has no dev server to hide behind, so this origin is the whole of
   * how a phone reaches the API once the app is built natively.
   */
  it('lets the native build through, which speaks from a scheme of its own', async () => {
    const response = await preflight(GUARDED, NATIVE)

    expect(response.headers['access-control-allow-origin']).toBe(NATIVE)
  })

  it('tells an origin nobody listed nothing it could use', async () => {
    const response = await preflight(GUARDED, STRANGER)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('keeps the refusal off the answers too, not only off the preflight', async () => {
    const response = await request(app.getHttpServer())
      .post(OPEN)
      .set('Origin', STRANGER)
      .send({ email: 'someone@example.org' })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('leaves a request that named no origin alone, it being nobody browser', async () => {
    const response = await request(app.getHttpServer()).post(OPEN).send({})

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.status).not.toBe(0)
  })
})
