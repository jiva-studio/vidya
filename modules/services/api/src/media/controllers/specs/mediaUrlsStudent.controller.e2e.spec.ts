import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'

import { TEST_MASTER_KEY } from './context'
import { Coursework, createReadFlow, ReadFlow } from './readFlow'

/**
 * A student holds no `media:read`: the place on the course is the whole of the
 * permission, and it reaches exactly the files the published lesson shows.
 */
describe('a student asking for a playable address', () => {
  let app: INestApplication
  let read: ReadFlow
  let shown: string
  let hidden: string
  let coursework: Coursework

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    read = await createReadFlow(app)

    shown = await read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner)
    hidden = await read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner)

    coursework = await read.publishCoursework(read.flow.ctx.one.school.id, [shown], [hidden])
  })

  afterEach(async () => {
    await app.close()
  })

  it('answers the place on the course, without any permission behind it', async () => {
    const response = await read.askUrls([shown], coursework.studentToken)

    expect(response.status).toBe(200)
    expect(response.body.urls[shown].url).toBeTruthy()
    expect(Date.parse(response.body.urls[shown].expiresAt)).toBeGreaterThan(Date.now())
  })

  it('refuses a file that only a draft shows, because nothing published names it', async () => {
    const response = await read.askUrls([hidden], coursework.studentToken)

    expect(response.status).toBe(403)
    expect(response.body.urls).toBeUndefined()
  })

  it('draws the published lesson even when a draft file is asked for beside it', async () => {
    const response = await read.askUrls([shown, hidden], coursework.studentToken)

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.urls)).toEqual([shown])
    expect(hidden in response.body.urls).toBe(false)
  })

  it('refuses someone with an account and no place on the course', async () => {
    const response = await read.askUrls([shown], coursework.strangerToken)

    expect(response.status).toBe(403)
    expect(response.body.urls).toBeUndefined()
  })
})
