import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { AuthContext, createAuthContext } from './context'

const routes = protocol.Routes()
const LOGIN = 'student@example.com'

describe('rate limiting on /auth', () => {
  let ctx: AuthContext

  afterEach(async () => {
    await ctx.app.close()
  })

  const server = () => ctx.app.getHttpServer()

  const requestCode = async (destination: string = LOGIN): Promise<string> => {
    await request(server()).post(routes.otp.root()).send({ type: 'email', destination }).expect(200)

    return ctx.mail.last.context.code
  }

  const signIn = (login: string, otp: string) =>
    request(server()).post(routes.auth.signIn('otp')).send({ login, otp })

  /* -------------------------------------------------------------------------- */
  /*                            POST /auth/signin/otp                           */
  /* -------------------------------------------------------------------------- */

  it('refuses the sixth sign-in attempt for one login inside the window', async () => {
    ctx = await createAuthContext()
    const code = await requestCode()

    for (let i = 0; i < 5; i++) {
      await signIn(LOGIN, 'wrong').expect(401)
    }

    // The fifth attempt above still reached the OTP check (401, wrong code).
    // The sixth is refused before it gets that far, regardless of whether the
    // code it carries is right.
    await signIn(LOGIN, code).expect(429)
  })

  it('does not let two different logins share one login’s throttle budget', async () => {
    ctx = await createAuthContext()
    const OTHER = 'other-student@example.com'
    await requestCode()
    await requestCode(OTHER)

    for (let i = 0; i < 5; i++) {
      await signIn(LOGIN, 'wrong').expect(401)
    }
    await signIn(LOGIN, 'wrong').expect(429)

    // A different login, same IP, still has its own budget untouched.
    await signIn(OTHER, 'wrong').expect(401)
  })

  it('does not let one login escape its throttle budget by switching IP', async () => {
    ctx = await createAuthContext((nest) => nest.set('trust proxy', true))
    await requestCode()

    const attempt = (ip: string) =>
      request(server())
        .post(routes.auth.signIn('otp'))
        .set('X-Forwarded-For', ip)
        .send({ login: LOGIN, otp: 'wrong' })

    for (let i = 0; i < 5; i++) {
      await attempt('203.0.113.1').expect(401)
    }

    // A fresh IP does not buy a fresh budget for the same login.
    await attempt('203.0.113.2').expect(429)
  })

  /* -------------------------------------------------------------------------- */
  /*                               POST /auth/otp                               */
  /* -------------------------------------------------------------------------- */

  it('refuses the fourth OTP request for one destination inside the hour', async () => {
    ctx = await createAuthContext()

    // Each cycle consumes its own code, so only the throttle — not the
    // "one live code" check — can be the reason the fourth request is refused.
    for (let i = 0; i < 3; i++) {
      const code = await requestCode()
      await signIn(LOGIN, code).expect(201)
    }

    return request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: LOGIN })
      .expect(429)
  })
})
