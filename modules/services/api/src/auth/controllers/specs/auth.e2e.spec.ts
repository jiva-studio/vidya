import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { AuthContext, createAuthContext } from './context'

describe('/auth', () => {
  let ctx: AuthContext

  beforeEach(async () => {
    ctx = await createAuthContext()
  })

  afterEach(async () => {
    await ctx.app.close()
  })

  const routes = protocol.Routes()
  const LOGIN = 'student@example.com'
  const OTHER_LOGIN = 'other-student@example.com'

  const server = () => ctx.app.getHttpServer()

  /** Asks for a code and reads it out of the mail that was "sent". */
  const requestCode = async (login: string = LOGIN): Promise<string> => {
    await request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: login })
      .expect(200)

    return ctx.mail.last.context.code
  }

  const signIn = async (login: string = LOGIN): Promise<protocol.OtpSignInResponse> => {
    const code = await requestCode(login)
    const response = await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login, otp: code })
      .expect(201)

    return response.body as protocol.OtpSignInResponse
  }

  /* -------------------------------------------------------------------------- */
  /*                                 Asking for a code                          */
  /* -------------------------------------------------------------------------- */

  it('mails a code to the address that asked for it', async () => {
    const code = await requestCode()

    expect(ctx.mail.messages).toHaveLength(1)
    expect(ctx.mail.last.to).toBe(LOGIN)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('refuses a second code while the first is still valid', async () => {
    await requestCode()

    return request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: LOGIN })
      .expect(429)
  })

  it('refuses sms outright rather than reporting a message it cannot send', async () => {
    // The branch used to be empty and still answered success, which also burned
    // a code into Redis and rate-limited the caller for five minutes.
    await request(server())
      .post(routes.otp.root())
      .send({ type: 'sms', destination: '+70000000000' })
      .expect(501)

    expect(ctx.mail.messages).toHaveLength(0)
    expect(ctx.redis.store.size).toBe(0)
  })

  it('rejects a request with no destination', () => {
    return request(server()).post(routes.otp.root()).send({ type: 'email' }).expect(400)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Signing in                                */
  /* -------------------------------------------------------------------------- */

  it('exchanges a valid code for a pair of tokens', async () => {
    const tokens = await signIn()

    expect(tokens.accessToken).toEqual(expect.any(String))
    expect(tokens.refreshToken).toEqual(expect.any(String))
  })

  it('creates the account on first sign-in', async () => {
    const first = await signIn()
    const second = await signIn()

    // Same login, so the second sign-in must find the account rather than fail
    // on the unique index.
    expect(second.accessToken).toEqual(expect.any(String))
    expect(second.accessToken).not.toBe(first.accessToken)
  })

  it('refuses a wrong code', async () => {
    await requestCode()

    return request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: '000000' })
      .expect(401)
  })

  it('refuses the same code twice', async () => {
    const code = await requestCode()

    await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: code })
      .expect(201)

    return request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: code })
      .expect(401)
  })

  it('refuses a code that was never issued', () => {
    return request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: '123456' })
      .expect(401)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Refreshing                                */
  /* -------------------------------------------------------------------------- */

  it('exchanges a refresh token for a new pair', async () => {
    const tokens = await signIn()

    const response = await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(200)

    const refreshed = response.body as protocol.RefreshTokensResponse

    expect(refreshed.accessToken).toEqual(expect.any(String))
    expect(refreshed.refreshToken).toEqual(expect.any(String))
  })

  it('refuses a refresh token that has already been spent', async () => {
    // Rotation is the point: a stolen refresh token is worth one use, and the
    // theft shows up as the real user being signed out.
    const tokens = await signIn()

    await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(200)

    return request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(401)
  })

  it('refuses a refresh token that is not a token at all', () => {
    return request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: 'not-a-jwt' })
      .expect(401)
  })

  it('refuses an access token in place of a refresh token', async () => {
    // Both are signed by the same key, so only the `typ` claim tells them apart.
    // Without it, whoever picks up an access token — the one sent on every
    // request — trades it here for a fresh 90-day session, which is exactly what
    // its one-hour lifetime is supposed to prevent.
    const tokens = await signIn()

    return request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.accessToken })
      .expect(401)
  })

  it('refuses a refresh token used as a bearer token', async () => {
    // The other direction: a refresh token carries no permissions, so the guard
    // would have looked them up and let it through as a session.
    const tokens = await signIn()

    return request(server())
      .post(routes.auth.signOut())
      .auth(tokens.refreshToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(401)
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Signing out                                */
  /* -------------------------------------------------------------------------- */

  it('signs out and stops the access token working', async () => {
    const tokens = await signIn()

    await request(server())
      .post(routes.auth.signOut())
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(201)

    return request(server())
      .post(routes.auth.signOut())
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(401)
  })

  it('signs out and stops the refresh token working', async () => {
    const tokens = await signIn()

    await request(server())
      .post(routes.auth.signOut())
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(201)

    return request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(401)
  })

  it('does not let one user revoke another users refresh token', async () => {
    const userA = await signIn()
    const userB = await signIn(OTHER_LOGIN)

    await request(server())
      .post(routes.auth.signOut())
      .auth(userA.accessToken, { type: 'bearer' })
      .send({ refreshToken: userB.refreshToken })
      .expect(201)

    await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: userB.refreshToken })
      .expect(200)

    return request(server())
      .post(routes.auth.signOut())
      .auth(userA.accessToken, { type: 'bearer' })
      .send({ refreshToken: userA.refreshToken })
      .expect(401)
  })

  it('refuses to sign out without a token', () => {
    return request(server()).post(routes.auth.signOut()).send({ refreshToken: 'x' }).expect(401)
  })
})
