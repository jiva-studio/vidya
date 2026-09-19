import { INestApplication } from '@nestjs/common'
import { SchoolsController } from '@vidya/api/edu/controllers'
import * as dto from '@vidya/api/edu/dto'
import { toSchoolSummaries } from '@vidya/api/edu/mappers/org.mapper'
import { SchoolsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'

import { Context, createContext } from './context'

const LOGO_URL = 'https://cdn.example.org/logos/devotion.png'
const DESCRIPTION = 'Scripture, kirtan and practice.'

/**
 * How a school presents itself: the fields a card is drawn from, which travel
 * to a device as well as to the console.
 */
describe('the presentation of a school', () => {
  let app: INestApplication
  let ctx: Context
  let ctr: SchoolsController

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
    ctr = app.get(SchoolsController)
  })

  afterEach(async () => {
    await app.close()
  })

  const store = async (): Promise<void> => {
    await app
      .get(SchoolsService)
      .updateOneBy({ id: ctx.one.school.id }, { logoUrl: LOGO_URL, description: DESCRIPTION })
  }

  it('hands back the logo and the description with the school', async () => {
    await store()

    const res = await ctr.getOne(ctx.one.school.id, await ctx.authenticate(ctx.one.users.owner))

    expect(res).toMatchObject({ logoUrl: LOGO_URL, description: DESCRIPTION })
  })

  it('keeps the logo in the list, which is what a row is drawn from', async () => {
    await store()

    const res = await ctr.getMany(await ctx.authenticate(ctx.one.users.owner))
    const row = res.items.find((item) => item.id === ctx.one.school.id)

    expect(row.logoUrl).toBe(LOGO_URL)
  })

  it('leaves the description out of the list, which has no room to show it', async () => {
    await store()

    const [row] = toSchoolSummaries([
      { ...ctx.one.school, logoUrl: LOGO_URL, description: DESCRIPTION },
    ])

    expect(row).not.toHaveProperty('description')
  })

  it('stores both fields when they are patched', async () => {
    const res = await ctr.updateOne(
      ctx.one.school.id,
      new dto.UpdateSchoolRequest({ logoUrl: LOGO_URL, description: DESCRIPTION }),
      await ctx.authenticate(ctx.one.users.owner),
    )

    expect(res).toMatchObject({
      name: ctx.one.school.name,
      logoUrl: LOGO_URL,
      description: DESCRIPTION,
    })
  })

  it('keeps them when a patch names only the name', async () => {
    await store()

    const res = await ctr.updateOne(
      ctx.one.school.id,
      new dto.UpdateSchoolRequest({ name: 'Renamed' }),
      await ctx.authenticate(ctx.one.users.owner),
    )

    expect(res).toMatchObject({ name: 'Renamed', logoUrl: LOGO_URL, description: DESCRIPTION })
  })

  it('clears one field without touching the other', async () => {
    await store()

    const res = await ctr.updateOne(
      ctx.one.school.id,
      Object.assign(new dto.UpdateSchoolRequest(), { logoUrl: null }),
      await ctx.authenticate(ctx.one.users.owner),
    )

    expect(res.logoUrl).toBeUndefined()
    expect(res.description).toBe(DESCRIPTION)
  })

  it('carries them onto a school the console creates', async () => {
    const created = await ctr.createOne(
      new dto.CreateSchoolRequest({ name: 'Second', logoUrl: LOGO_URL, description: DESCRIPTION }),
      await ctx.authenticate(ctx.one.users.owner),
    )

    const school = await app.get(SchoolsService).findOneBy({ id: created.id })

    expect(school).toMatchObject({ logoUrl: LOGO_URL, description: DESCRIPTION })
  })
})
