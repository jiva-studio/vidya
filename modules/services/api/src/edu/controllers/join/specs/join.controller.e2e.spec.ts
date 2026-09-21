import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext, LISTED_CODE } from './context'

const routes = protocol.Routes().join

/**
 * Resolving a joining link, before anyone has an account.
 *
 * Every case here is either "a stranger may read this" or "a stranger may read
 * only this": the route is the one door in the API that answers without a
 * token, so what it says is what the whole internet may know about a school.
 */
describe('GET /j/:code', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('answers a caller who sends no Authorization header at all', async () => {
    const response = await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE))

    expect(response.status).toBe(200)
  })

  it('returns the school that holds the code', async () => {
    const response = await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    const body = response.body as protocol.ResolveSchoolResponse

    expect(body.id).toBe(ctx.listed.school.id)
    expect(body.name).toBe(ctx.listed.school.name)
    expect(body.logoUrl).toBe('https://cdn.example.org/logo.png')
  })

  it('carries the card and nothing else — no description, no config, no members', async () => {
    const response = await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    expect(Object.keys(response.body).sort()).toEqual(['id', 'logoUrl', 'name'])
  })

  it('resolves the same school for a code typed in lower case', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.resolve(LISTED_CODE.toLowerCase()))
      .expect(200)

    expect((response.body as protocol.ResolveSchoolResponse).id).toBe(ctx.listed.school.id)
  })

  // Each refusal below first resolves the code that does work. An absent route
  // answers 404 to everything, so without that line the case would read as
  // satisfied by a door that is not there.

  it('answers 404 for a well-formed code no school holds', async () => {
    await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    return request(app.getHttpServer()).get(routes.resolve('ZZZZZZ')).expect(404)
  })

  it('answers 404, not 400, for a code of the wrong length', async () => {
    // The two are not distinguished on purpose: telling a guesser that the
    // shape was right narrows the search for them.
    await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    return request(app.getHttpServer()).get(routes.resolve('AB3K7')).expect(404)
  })

  it('answers 404, not 400, for a code carrying a letter outside the alphabet', async () => {
    await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    return request(app.getHttpServer()).get(routes.resolve('ABIK7Q')).expect(404)
  })

  it('does not reach a school that has never created a code', async () => {
    await request(app.getHttpServer()).get(routes.resolve(LISTED_CODE)).expect(200)

    const response = await request(app.getHttpServer()).get(routes.resolve('ZZZZZZ')).expect(404)

    expect(JSON.stringify(response.body)).not.toContain(ctx.unlisted.school.id)
  })
})
