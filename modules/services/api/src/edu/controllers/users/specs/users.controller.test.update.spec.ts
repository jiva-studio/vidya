import { INestApplication } from '@nestjs/common'
import { UsersController } from '@vidya/api/edu/controllers'
import * as dto from '@vidya/api/edu/dto'
import { toUserDetails } from '@vidya/api/edu/mappers/org.mapper'
import { UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'

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

  /* -------------------------------------------------------------------------- */
  /*                                 Update One                                 */
  /* -------------------------------------------------------------------------- */

  describe('updateOne', () => {
    it('updates user by Id', async () => {
      const res = await ctr.updateOne(
        new dto.UpdateUserRequest({ name: 'Updated Name' }),
        ctx.one.users.oneAdmin.id,
        await ctx.authenticate(ctx.one.users.oneAdmin),
      )

      expect(res).toEqual(
        toUserDetails(await app.get(UsersService).findOneBy({ id: ctx.one.users.oneAdmin.id })),
      )
    })

    it('allows a user without permissions to update their own name', async () => {
      const res = await ctr.updateOne(
        new dto.UpdateUserRequest({ name: 'Self Renamed' }),
        ctx.misc.users.empty.id,
        await ctx.authenticate(ctx.misc.users.empty),
      )

      expect(res.name).toBe('Self Renamed')
    })

    it('refuses to let a user without permissions update their own email', async () => {
      await expect(async () => {
        await ctr.updateOne(
          new dto.UpdateUserRequest({ email: 'newemail@example.com' }),
          ctx.misc.users.empty.id,
          await ctx.authenticate(ctx.misc.users.empty),
        )
      }).rejects.toThrow(`User does not have permission`)
    })

    it('refuses to let a user without permissions update their own phone', async () => {
      await expect(async () => {
        await ctr.updateOne(
          new dto.UpdateUserRequest({ phone: '+123456789' }),
          ctx.misc.users.empty.id,
          await ctx.authenticate(ctx.misc.users.empty),
        )
      }).rejects.toThrow(`User does not have permission`)
    })

    it('throws if user do not have permission', async () => {
      await expect(async () => {
        await ctr.updateOne(
          new dto.UpdateUserRequest({ name: 'Updated Name' }),
          ctx.one.users.oneAdmin.id,
          await ctx.authenticate(ctx.two.users.twoAdmin),
        )
      }).rejects.toThrow(`User does not have permission`)
    })
  })
})
