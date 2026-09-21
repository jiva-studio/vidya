import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { createStorageContext, refusalFor, StorageContext, TEST_MASTER_KEY } from './context'

const ROUTE = 'POST /edu/schools/:schoolId/storage/verify'

/**
 * A secret is sealed against the row that holds it: the school and the profile
 * are part of the additional data, so a ciphertext lifted from one row and
 * written into another stops being readable. These suites move it by hand
 * through SQL, which is what a leaked dump or a mistaken migration would do.
 */
describe('a secret carried into a row it was not sealed for', () => {
  let app: INestApplication
  let ctx: StorageContext

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    ctx = await createStorageContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const configure = async (schoolId: string, user: Parameters<typeof ctx.getAuthTokenFor>[0]) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))
      .send(ctx.credentialsFor(schoolId))
      .expect(200)

  const verify = async (schoolId: string, user: Parameters<typeof ctx.getAuthTokenFor>[0]) =>
    request(app.getHttpServer())
      .post(Routes().edu.schools.storage.verify(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))

  it('proves the credentials again when nothing has been moved', async () => {
    await configure(ctx.one.school.id, ctx.one.users.owner)

    const response = await verify(ctx.one.school.id, ctx.one.users.owner)

    expect(response.status).toBe(200)
    expect(response.body.data.verifyError).toBeNull()
    expect(response.body.data.verifiedAt).toEqual(expect.any(String))
  })

  it('does not read a secret moved between two profiles of the same school', async () => {
    const refusal = refusalFor(ROUTE, MediaRefusals.secretUnreadable)
    const retired = await configure(ctx.one.school.id, ctx.one.users.owner)
    const current = await configure(ctx.one.school.id, ctx.one.users.owner)

    await ctx.moveSecretCiphertext(retired.body.data.id, current.body.data.id)
    const response = await verify(ctx.one.school.id, ctx.one.users.owner)

    expect(response.status).toBe(refusal.status)
    expect(response.body.message).toEqual([MediaRefusals.secretUnreadable])

    const [, row] = await ctx.profileRows(ctx.one.school.id)
    expect(row.verifyError).not.toBeNull()
  })

  it('does not read a secret moved in from another school', async () => {
    const refusal = refusalFor(ROUTE, MediaRefusals.secretUnreadable)
    const mine = await configure(ctx.one.school.id, ctx.one.users.owner)
    const theirs = await configure(ctx.two.school.id, ctx.two.users.technician)

    await ctx.moveSecretCiphertext(theirs.body.data.id, mine.body.data.id)
    const response = await verify(ctx.one.school.id, ctx.one.users.owner)

    expect(response.status).toBe(refusal.status)
    expect(response.body.message).toEqual([MediaRefusals.secretUnreadable])

    const [row] = await ctx.profileRows(ctx.one.school.id)
    expect(row.verifyError).not.toBeNull()
  })

  // An unreadable ciphertext is ours to explain; it is neither an address we
  // refused nor keys the storage turned away, and a school acts on each
  // differently.
  it('tells an unreadable secret apart from keys the storage turned away', async () => {
    const mine = await configure(ctx.one.school.id, ctx.one.users.owner)
    const theirs = await configure(ctx.two.school.id, ctx.two.users.technician)

    await ctx.moveSecretCiphertext(theirs.body.data.id, mine.body.data.id)
    const response = await verify(ctx.one.school.id, ctx.one.users.owner)

    expect(response.status).toBe(409)
    expect(response.body.message).not.toContain(MediaRefusals.credentialsRejected)
    expect(response.body.message).not.toContain(MediaRefusals.endpointRejected)
    expect(response.body.message).not.toContain(MediaRefusals.storageUnreachable)
  })

  it('never names the secret in the reason a probe failed', async () => {
    const mine = await configure(ctx.one.school.id, ctx.one.users.owner)
    const theirs = await configure(ctx.two.school.id, ctx.two.users.technician)

    await ctx.moveSecretCiphertext(theirs.body.data.id, mine.body.data.id)
    const response = await verify(ctx.one.school.id, ctx.one.users.owner)

    expect(response.status).toBe(409)
    expect(response.text).not.toContain(ctx.credentialsFor(ctx.one.school.id).secret)
  })
})
