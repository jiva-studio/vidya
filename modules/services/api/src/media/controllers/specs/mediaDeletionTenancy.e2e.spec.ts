import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { UploadGrant } from '@vidya/domain'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

describe('a deletion aimed at a file outside the caller’s school', () => {
  let app: INestApplication
  let flow: MediaFlow
  let theirFile: string

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)

    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)

    const other = flow.ctx.two.school.id
    await flow.configureStorage(other, flow.ctx.two.users.technician)

    const asked = await flow.askUpload(
      flow.imageUpload(other, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.two.users.technician,
    )
    expect(asked.status).toBe(201)

    await flow.putBytes(asked.body.grant as UploadGrant, Buffer.alloc(2048, 3))
    expect(
      (await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.two.users.technician)).status,
    ).toBe(200)

    theirFile = asked.body.mediaId as string
  })

  afterEach(async () => {
    await app.close()
  })

  /** Asked by a technician of school one, who holds `media:delete` in school one only. */
  const remove = async (mediaId: string) =>
    request(app.getHttpServer())
      .delete(Routes().media.delete(mediaId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  it('answers a file of another school the same way as one that was never stored', async () => {
    const theirs = await remove(theirFile)
    const nobodys = await remove(faker.string.uuid())

    expect([theirs.status, nobodys.status]).toEqual([404, 404])
  })

  it('says no more about a file of another school than about one that was never stored', async () => {
    const theirs = await remove(theirFile)
    const nobodys = await remove(faker.string.uuid())

    expect(theirs.body.error).toEqual(nobodys.body.error)
  })

  it('still tells a caller of the file\u2019s own school that they may not delete it', async () => {
    const mine = await flow.askUpload(
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )
    expect(mine.status).toBe(201)

    const response = await request(app.getHttpServer())
      .delete(Routes().media.delete(mine.body.mediaId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.readonly))

    expect(response.status).toBe(403)
  })

  it('leaves the other school its file whatever it answered', async () => {
    await remove(theirFile)

    expect((await flow.mediaRow(theirFile))?.status).toBe('ready')
  })
})
