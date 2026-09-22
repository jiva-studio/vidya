import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { UploadGrant } from '@vidya/domain'
import { User } from '@vidya/entities'

import { TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow, mediaPageFixture } from './uploadFlow'

const keysOf = (value: Record<string, unknown>): string[] => Object.keys(value).sort()

const pageFixture = mediaPageFixture.response as {
  items: Record<string, unknown>[]
  page: number
  pageSize: number
}

describe('listing the library of a school', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
    await flow.configureStorage(flow.ctx.two.school.id, flow.ctx.two.users.technician)
  })

  afterEach(async () => {
    await app.close()
  })

  const ask = async (
    schoolId: string,
    user: User,
    overrides: Record<string, unknown>,
  ): Promise<{ mediaId: string; grant: UploadGrant }> => {
    const response = await flow.askUpload(flow.imageUpload(schoolId, overrides), user)

    expect(response.status).toBe(201)
    return { mediaId: response.body.mediaId, grant: response.body.grant as UploadGrant }
  }

  const store = async (
    schoolId: string,
    user: User,
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const granted = await ask(schoolId, user, { sizeBytes: 2048, sha256: undefined, ...overrides })

    await flow.putBytes(granted.grant, Buffer.alloc(2048, 5))
    const completed = await flow.completeUpload(granted.mediaId, {}, user)
    expect(completed.status).toBe(200)

    return granted.mediaId
  }

  const list = async (query: Record<string, string | number>) =>
    flow.listMedia({ schoolId: flow.ctx.one.school.id, ...query }, flow.ctx.one.users.owner)

  it('describes a stored file with exactly the fields the gallery reads', async () => {
    await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, { name: 'lesson-cover.png' })

    const response = await list({})

    expect(response.status).toBe(200)
    expect(keysOf(response.body.items[0])).toEqual(keysOf(pageFixture.items[0]))
  })

  it('answers the first page with the size the contract fixes', async () => {
    await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, { name: 'lesson-cover.png' })

    const response = await list({})

    expect(response.body).toMatchObject({
      total: 1,
      page: pageFixture.page,
      pageSize: pageFixture.pageSize,
    })
  })

  it('leaves out a file whose bytes never landed', async () => {
    const pending = await ask(flow.ctx.one.school.id, flow.ctx.one.users.owner, {
      sizeBytes: 2048,
      name: 'never-arrived.png',
    })

    const response = await list({})

    expect(response.body.items).toEqual([])
    expect(response.text).not.toContain(pending.mediaId)
  })

  it('narrows the list to the files whose name carries the term', async () => {
    const wanted = await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, {
      name: 'lesson-cover.png',
    })
    await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, { name: 'diagram.png' })

    const response = await list({ term: 'cover' })

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([wanted])
  })

  it('narrows the list to one kind of file', async () => {
    const image = await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, {
      name: 'lesson-cover.png',
    })
    await store(flow.ctx.one.school.id, flow.ctx.one.users.owner, {
      kind: 'audio',
      mimeType: 'audio/mpeg',
      name: 'lecture-04.mp3',
    })

    const response = await list({ kind: 'image' })

    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([image])
  })

  it('never shows a school a file that belongs to another one', async () => {
    const theirs = await store(flow.ctx.two.school.id, flow.ctx.two.users.technician, {
      name: 'lesson-cover.png',
    })

    const own = await list({})
    const asked = await flow.listMedia(
      { schoolId: flow.ctx.two.school.id },
      flow.ctx.one.users.owner,
    )

    expect(own.body.items).toEqual([])
    expect(asked.text).not.toContain(theirs)
  })
})
