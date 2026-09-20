import { AuditLog } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { AuthContext, createAuthContext } from './context'

describe('/auth audit trail', () => {
  let ctx: AuthContext

  beforeEach(async () => {
    ctx = await createAuthContext()
  })

  afterEach(async () => {
    await ctx.app.close()
  })

  const routes = protocol.Routes()
  const LOGIN = 'student@example.com'

  const server = () => ctx.app.getHttpServer()

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

  const auditRows = async (): Promise<AuditLog[]> =>
    ctx.app.get(DataSource).getRepository(AuditLog).find()

  it('names the login and the resulting user on a successful sign-in', async () => {
    await signIn()

    const rows = await auditRows()
    const entry = rows.find((row) => row.action === 'auth.signIn.success')

    expect(entry).toBeDefined()
    expect(entry?.actorLogin).toBe(LOGIN)
    expect(entry?.actorUserId).toEqual(expect.any(String))
    expect(entry?.subjectId).toBe(entry?.actorUserId)
  })

  it('names the login and no user on a failed sign-in', async () => {
    await requestCode()

    await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: '000000' })
      .expect(401)

    const rows = await auditRows()
    const entry = rows.find((row) => row.action === 'auth.signIn.failure')

    expect(entry).toBeDefined()
    expect(entry?.actorLogin).toBe(LOGIN)
    expect(entry?.actorUserId).toBeNull()
  })

  it('records a sign-out', async () => {
    const tokens = await signIn()

    await request(server())
      .post(routes.auth.signOut())
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(201)

    const rows = await auditRows()
    const entry = rows.find((row) => row.action === 'auth.signOut')

    expect(entry).toBeDefined()
    expect(entry?.actorUserId).toEqual(expect.any(String))
  })

  it('records a token refresh', async () => {
    const tokens = await signIn()

    await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(200)

    const rows = await auditRows()
    const entry = rows.find((row) => row.action === 'auth.token.refresh')

    expect(entry).toBeDefined()
    expect(entry?.actorUserId).toEqual(expect.any(String))
  })

  it('never persists an OTP code or a token in any audit entry', async () => {
    // Drives every wired event — a wrong guess, a real sign-in, a refresh and
    // a sign-out — then checks the property that matters: none of the secrets
    // that passed through this flow ever reached the table, in any column.
    // This is deliberately a search over the whole row rather than an
    // assertion about `payload` alone, since that is the shape a future
    // change is most likely to break.
    const code = await requestCode()

    await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: '000000' })
      .expect(401)

    const signInResponse = await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: code })
      .expect(201)
    const tokens = signInResponse.body as protocol.OtpSignInResponse

    const refreshResponse = await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: tokens.refreshToken })
      .expect(200)
    const refreshed = refreshResponse.body as protocol.RefreshTokensResponse

    await request(server())
      .post(routes.auth.signOut())
      .auth(refreshed.accessToken, { type: 'bearer' })
      .send({ refreshToken: refreshed.refreshToken })
      .expect(201)

    const rows = await auditRows()
    expect(rows.length).toBeGreaterThanOrEqual(4)

    const secrets = [
      code,
      tokens.accessToken,
      tokens.refreshToken,
      refreshed.accessToken,
      refreshed.refreshToken,
    ]

    for (const row of rows) {
      const serialized = JSON.stringify(row)
      for (const secret of secrets) {
        expect(serialized).not.toContain(secret)
      }
    }
  })
})
