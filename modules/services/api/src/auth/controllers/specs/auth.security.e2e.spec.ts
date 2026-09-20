import { JwtService } from '@nestjs/jwt'
import { OtpAttemptsStorageKey, OtpStorageKey, Routes } from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'

import { AuthContext, createAuthContext } from './context'

/**
 * The individual security fixes (#25, #27–#33, #37, #38) each shipped with
 * tests for their own change. This file is not about any one of them: it is
 * about the perimeter they form together, and the two or three places where
 * they interact in a way no single fix's own suite would notice breaking.
 *
 * A lot of what a "security regression suite" would normally list here
 * already exists, at the right level, in `auth.e2e.spec.ts`,
 * `auth.throttling.e2e.spec.ts`, `tokens.controller.spec.ts`,
 * `otp.service.spec.ts`, `jwt.config.spec.ts` and `swagger/specs/setup.spec.ts`.
 * This file does not repeat those — see each `describe` below for which
 * property is new and why the existing coverage does not already reach it.
 *
 * One property has no e2e test anywhere, deliberately: #27's `await` on the
 * refresh-token revocation write. `context.ts`'s `FakeRedis` resolves every
 * call synchronously, so there is no macrotask for two racing refreshes to
 * interleave on — an e2e test built on it cannot fail the way the bug did,
 * only "pass" regardless of the `await`. `tokens.controller.spec.ts` proves
 * it instead, with a `revoke` stub resolved on a real macrotask; that is the
 * only level at which this ordering is observable at all.
 */
const routes = Routes()

describe('the authentication perimeter', () => {
  let ctx: AuthContext

  afterEach(async () => {
    await ctx.app.close()
  })

  const server = () => ctx.app.getHttpServer()

  const requestCode = async (login: string): Promise<string> => {
    await request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: login })
      .expect(200)

    return ctx.mail.last.context.code
  }

  const wrongGuess = (login: string, otp = 'wrong-code') =>
    request(server()).post(routes.auth.signIn('otp')).send({ login, otp })

  /* -------------------------------------------------------------------------- */
  /*              The OTP guess budget, isolated from the throttle              */
  /* -------------------------------------------------------------------------- */

  describe('a code burned by its own guess budget', () => {
    /**
     * `auth.e2e.spec.ts` already has "shares the OTP attempt budget across
     * login capitalisation and whitespace variants" — but its own comment
     * admits it cannot tell whether the final 429 comes from the OTP budget
     * or from the sign-in throttle, because both are configured to exactly
     * five (`otp.service.ts`'s `maxAttempts` and `throttler.config.ts`'s
     * `signin.loginLimit`) over the same login. Five real wrong HTTP guesses
     * plus a sixth, correct one always trips the throttle first — the guard
     * runs before the controller — so no purely-HTTP test can observe the
     * *burn* rather than the *throttle* at that boundary.
     *
     * This test sidesteps that by priming four of the five guesses directly
     * into the fake store (the same `ctx.redis.store` the "refuses sms
     * outright" test in `auth.e2e.spec.ts` already pokes at directly), so
     * only two real requests are made against this login — nowhere near the
     * throttle's own limit. The fifth guess, made for real over HTTP, is the
     * one that burns the code; the sixth, with the *right* code, proves the
     * burn rather than the throttle refused it.
     */
    it('refuses even the right code once the budget is spent, independent of the throttle', async () => {
      ctx = await createAuthContext()
      const login = 'burns-the-budget@example.com'
      const code = await requestCode(login)

      ctx.redis.store.set(OtpAttemptsStorageKey(login), '4')

      // The fifth wrong guess — this is the one that burns the code.
      await wrongGuess(login).expect(401)

      // The right code, now that the budget is gone.
      return wrongGuess(login, code).expect(401)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                    One 401, whatever refused the code                     */
  /* -------------------------------------------------------------------------- */

  describe('a wrong code, an expired code and an exhausted budget', () => {
    /**
     * `OtpService.validate` funnels every non-success case — no code stored,
     * a wrong guess, a guess that exhausts the budget — through the same
     * `return undefined`, and the controller turns every `undefined` into
     * the same `UnauthorizedException(['otp is invalid'])`. That collapse is
     * deliberate (see the docblock on `validate`): a caller who can tell
     * these apart learns whether a login has a live code at all. This test
     * pins the collapse down as a response the controller actually sends,
     * not just an implication of the code's shape, so a future change that
     * gives one of these three a more specific message is caught here rather
     * than by an attacker enumerating logins.
     */
    it('answers all three with the same status and body', async () => {
      ctx = await createAuthContext()

      const wrongLogin = 'wrong-code@example.com'
      await requestCode(wrongLogin)
      const wrong = await wrongGuess(wrongLogin).expect(401)

      const expiredLogin = 'expired-code@example.com'
      await requestCode(expiredLogin)
      // Simulates the TTL running out without waiting five real minutes on it.
      ctx.redis.store.delete(OtpStorageKey(expiredLogin))
      const expired = await wrongGuess(expiredLogin, 'whatever-now').expect(401)

      const exhaustedLogin = 'exhausted-budget@example.com'
      const exhaustedCode = await requestCode(exhaustedLogin)
      ctx.redis.store.set(OtpAttemptsStorageKey(exhaustedLogin), '4')
      await wrongGuess(exhaustedLogin).expect(401) // burns it
      const exhausted = await wrongGuess(exhaustedLogin, exhaustedCode).expect(401)

      expect(wrong.body).toEqual(expired.body)
      expect(wrong.body).toEqual(exhausted.body)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                        A token from a different key                       */
  /* -------------------------------------------------------------------------- */

  describe('a token signed with a key this API never configured', () => {
    /**
     * Not covered anywhere else in the auth specs: every existing forged- or
     * malformed-token case (`not-a-jwt`, an access token in the refresh slot,
     * a refresh token used as a bearer token) still carries this API's own
     * signature. This is the case where the signature itself is wrong —
     * `AuthService.verifyToken` catches `jwtService.verifyAsync`'s rejection
     * and returns `undefined`, same as any other invalid token.
     */
    it('is refused at the refresh door', async () => {
      ctx = await createAuthContext()
      const jwt = ctx.app.get(JwtService)

      const forged = await jwt.signAsync(
        { jti: randomUUID(), sub: randomUUID(), typ: 'refresh' },
        { secret: 'a-key-this-deployment-never-configured-32chars', expiresIn: '90d' },
      )

      return request(server())
        .post(routes.auth.tokens.refresh())
        .send({ refreshToken: forged })
        .expect(401)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*        Capitalisation variants share the sign-in throttle bucket          */
  /* -------------------------------------------------------------------------- */

  describe('capitalisation and whitespace variants of a login, at the throttle', () => {
    /**
     * `SIGNIN_THROTTLE` (`user-authentication.controller.ts`) reads the login
     * straight off the raw request body — guards run before the validation
     * pipe's `@Transform` does — so it calls `normalizeLogin` itself to key
     * on the same string the DTO would produce. That duplication is exactly
     * the kind of thing a refactor "cleans up" by mistake: move normalisation
     * to one place, forget the guard was relying on its own copy, and five
     * spellings of one login quietly get five separate throttle budgets
     * instead of one.
     *
     * `auth.e2e.spec.ts`'s capitalisation test already drives multiple
     * spellings, but every guess there is against a login that *has* a live
     * code, so its final 429 could just as easily be the OTP budget as the
     * throttle (see the "isolated from the throttle" `describe` above for the
     * full argument). This test never requests a code for this login at all:
     * `OtpService.validate` returns on a missing code before it ever reaches
     * the guess counter, so nothing here can burn a budget that does not
     * exist — only the throttle can be what refuses the sixth spelling.
     */
    it('refuses the sixth spelling in the same window, with no code ever issued', async () => {
      ctx = await createAuthContext()

      const spellings = [
        'Case@Example.com',
        'CASE@EXAMPLE.COM',
        '  case@example.com',
        'case@example.com  ',
        'Case@example.COM',
      ]

      for (const login of spellings) {
        await wrongGuess(login, 'irrelevant').expect(401)
      }

      return wrongGuess('case@example.com', 'irrelevant').expect(429)
    })
  })
})
