import { Test } from '@nestjs/testing'
import { AuthService, AuthUsersService, RevokedTokensService } from '@vidya/api/auth/services'
import { AuditLogService } from '@vidya/api/shared/services'
import * as domain from '@vidya/domain'
import { User } from '@vidya/entities'
import { RefreshToken } from '@vidya/protocol'

import { TokensController } from '../tokens.controller'

const USER = domain.asId<domain.UserId>('11111111-1111-1111-1111-111111111111')

const REFRESH_TOKEN: RefreshToken = {
  sub: USER,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  jti: 'jti-1',
  typ: 'refresh',
}

describe('TokensController', () => {
  describe('refreshTokens', () => {
    it('does not respond until the refresh token has been revoked', async () => {
      // The revoke call used to run unawaited: the handler could answer with a
      // fresh session while the Redis write was still in flight, so two
      // refreshes racing the same token could both be granted one. Resolving
      // `revoke` on a macrotask, after everything else the handler touches
      // (which all resolve on plain microtasks), makes that ordering something
      // this test can see rather than a race against the event loop.
      const revoke = jest.fn(() => new Promise<void>((resolve) => setImmediate(resolve)))

      const module = await Test.createTestingModule({
        controllers: [TokensController],
        providers: [
          {
            provide: RevokedTokensService,
            useValue: { isRevoked: jest.fn().mockResolvedValue(false), revoke },
          },
          {
            provide: AuthService,
            useValue: {
              verifyToken: jest.fn().mockResolvedValue(REFRESH_TOKEN),
              generateTokens: jest
                .fn()
                .mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
            },
          },
          {
            provide: AuthUsersService,
            useValue: {
              findById: jest.fn().mockResolvedValue({ id: USER } as User),
              getUserPermissions: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AuditLogService,
            useValue: { record: jest.fn().mockResolvedValue(undefined) },
          },
        ],
      }).compile()

      const controller = module.get(TokensController)
      const req = { ip: '127.0.0.1' } as Parameters<typeof controller.refreshTokens>[1]

      let settled = false
      const call = controller
        .refreshTokens({ refreshToken: 'refresh-token' }, req)
        .then((response) => {
          settled = true
          return response
        })

      // Drain the microtask queue several times over. Every other mock above
      // resolves on a microtask, so an unawaited `revoke` would let the handler
      // reach its `return` well within this many turns; only awaiting the real
      // `revoke` keeps it waiting for the macrotask that call is parked on.
      for (let i = 0; i < 10; i++) {
        await Promise.resolve()
      }
      expect(settled).toBe(false)
      expect(revoke).toHaveBeenCalledWith(REFRESH_TOKEN)

      const response = await call

      expect(settled).toBe(true)
      expect(response.accessToken).toBe('new-access')
    })
  })
})
