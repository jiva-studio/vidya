import { INestApplication } from '@nestjs/common'
import { UsersController } from '@vidya/api/edu/controllers'
import * as dto from '@vidya/api/edu/dto'
import { toUserDetails, toUserSummaries } from '@vidya/api/edu/mappers/org.mapper'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as entities from '@vidya/entities'

import { Context, createContext } from './context'

describe('UsersController', () => {
  let app: INestApplication
  let ctx: Context
  let ctr: UsersController

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
    ctr = app.get(UsersController)
  })

  function expectUsers(res: dto.GetUsersResponse, users: entities.User[]) {
    expect(res).toHaveProperty('items')
    expect(res.items).toHaveLength(users.length)
    expect(res.items).toEqual(expect.arrayContaining(toUserSummaries(users)))
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Get One                                  */
  /* -------------------------------------------------------------------------- */

  describe('getOne', () => {
    it('returns user by Id', async () => {
      const res = await ctr.getOne(
        ctx.one.users.oneAdmin.id,
        await ctx.authenticate(ctx.one.users.oneAdmin),
      )
      expect(res).toEqual(toUserDetails(ctx.one.users.oneAdmin))
    })

    it('returns 404 if access is not permitted', async () => {
      await expect(async () => {
        await ctr.getOne(ctx.one.users.oneAdmin.id, await ctx.authenticate(ctx.two.users.twoAdmin))
      }).rejects.toThrow(`User with id ${ctx.one.users.oneAdmin.id} not found`)
    })

    it('returns 403 for user without any permissions', async () => {
      await expect(async () => {
        await ctr.getOne(ctx.one.users.oneAdmin.id, await ctx.authenticate(ctx.misc.users.empty))
      }).rejects.toThrow(`User does not have permission`)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Get Many                                 */
  /* -------------------------------------------------------------------------- */

  describe('getMany', () => {
    it('returns all users in permitted school', async () => {
      const res = await ctr.getMany(
        new dto.GetUsersQuery(),
        await ctx.authenticate(ctx.one.users.oneAdmin),
      )
      expectUsers(res, [ctx.one.users.oneAdmin, ctx.misc.users.adminOfOneAndTwo])
    })

    it('returns all users in multiple permitted schools', async () => {
      const res = await ctr.getMany(
        new dto.GetUsersQuery(),
        await ctx.authenticate(ctx.misc.users.adminOfOneAndTwo),
      )
      expectUsers(res, [
        ctx.one.users.oneAdmin,
        ctx.two.users.twoAdmin,
        ctx.misc.users.adminOfOneAndTwo,
      ])
    })

    it('filters by schoolId', async () => {
      const res = await ctr.getMany(
        new dto.GetUsersQuery({ schoolId: ctx.one.school.id }),
        await ctx.authenticate(ctx.misc.users.adminOfOneAndTwo),
      )
      expectUsers(res, [ctx.one.users.oneAdmin, ctx.misc.users.adminOfOneAndTwo])
    })
  })
})
