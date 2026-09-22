import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { AuditLog } from '@vidya/entities'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createStorageContext, StorageContext, TEST_MASTER_KEY } from './context'

const PASSWORD_IN_THE_HOST = 'hunter2'
const WITH_USERINFO = `https://attacker:${PASSWORD_IN_THE_HOST}@de-s3.storage.bunnycdn.com`

/**
 * An endpoint carrying credentials in front of the host.
 *
 * The SDK strips them before dialling, so this is not a way past the address
 * check — it is a password landing in a field the profile reads back to anyone
 * with `storage:read` and repeats into the audit trail.
 */
describe('an endpoint with credentials written into it', () => {
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

  const put = async (endpoint: string) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send({ ...ctx.credentialsFor(ctx.one.school.id), endpoint })

  const read = async () =>
    request(app.getHttpServer())
      .get(Routes().edu.schools.storage.get(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))

  it('is refused, even though the host it names is one we would dial', async () => {
    const response = await put(WITH_USERINFO)

    expect(response.status).toBe(422)
    expect(response.body.message).toEqual([MediaRefusals.endpointRejected])
  })

  it('leaves the school without a profile rather than storing the password', async () => {
    await put(WITH_USERINFO)

    await expect(ctx.profileRows(ctx.one.school.id)).resolves.toEqual([])
    await expect(ctx.currentProfileIdOf(ctx.one.school.id)).resolves.toBeNull()
  })

  it('does not echo the password back in the refusal', async () => {
    const response = await put(WITH_USERINFO)

    expect(response.text).not.toContain(PASSWORD_IN_THE_HOST)
  })

  it('never reads an endpoint back with a credential in front of the host', async () => {
    await put(WITH_USERINFO)

    const response = await read()

    expect(response.body.data?.endpoint ?? '').not.toContain('@')
    expect(response.text).not.toContain(PASSWORD_IN_THE_HOST)
  })

  it('never writes an endpoint into the trail with a credential in front of the host', async () => {
    await put(WITH_USERINFO)
    await put('https://de-s3.storage.bunnycdn.com')

    const rows = await app.get(DataSource).getRepository(AuditLog).find()

    expect(JSON.stringify(rows)).not.toContain(PASSWORD_IN_THE_HOST)
    expect(rows.filter((row) => JSON.stringify(row.payload).includes('@'))).toEqual([])
  })
})
