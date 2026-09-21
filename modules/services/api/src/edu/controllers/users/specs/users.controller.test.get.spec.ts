import { INestApplication } from '@nestjs/common'
import { UsersController } from '@vidya/api/edu/controllers'
import * as dto from '@vidya/api/edu/dto'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as entities from '@vidya/entities'

import { toUserDetails } from '../../../mappers/org.mapper'
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

  afterEach(async () => {
    await app.close()
  })

  // By identity, not by the whole summary: the roles a row carries are the
  // ones held in the schools being listed, which is narrower than the roles
  // the fixture entity holds everywhere.
  function expectUsers(res: dto.GetUsersResponse, users: entities.User[]) {
    expect(res).toHaveProperty('items')
    expect(res.items).toHaveLength(users.length)
    expect(res.items.map((item) => item.id).sort()).toEqual(users.map((user) => user.id).sort())
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

    // Somebody with a role in two schools is listed in both, and each list
    // names only its own: the other school's role is not this page's business.
    it('names only the roles held in the school being listed', async () => {
      const res = await ctr.getMany(
        new dto.GetUsersQuery({ schoolId: ctx.one.school.id }),
        await ctx.authenticate(ctx.misc.users.adminOfOneAndTwo),
      )

      const both = res.items.find((item) => item.id === ctx.misc.users.adminOfOneAndTwo.id)

      expect(both?.roles.map((role) => role.name)).toEqual(['Org Admin'])
    })

    it('answers how many matched, beside the page', async () => {
      const res = await ctr.getMany(
        new dto.GetUsersQuery(),
        await ctx.authenticate(ctx.one.users.oneAdmin),
      )

      expect(res.total).toBe(res.items.length)
    })

    it('returns one page when one is asked for', async () => {
      const query = new dto.GetUsersQuery()
      query.limit = 1

      const res = await ctr.getMany(query, await ctx.authenticate(ctx.one.users.oneAdmin))

      expect(res.items).toHaveLength(1)
      expect(res.total).toBe(2)
    })
  })
})
