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
