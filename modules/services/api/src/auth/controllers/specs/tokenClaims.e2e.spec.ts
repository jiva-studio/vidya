import { JwtService } from '@nestjs/jwt'
import { JwtConfig } from '@vidya/api/configs'
import { Role, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { AuthContext, createAuthContext } from './context'

const routes = protocol.Routes()
const LOGIN = 'student@example.com'

const claimsOf = (token: string): protocol.AccessToken =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())

/**
 * Both doors hand out the same token.
 *
 * They did not always: sign-in put the permissions in only under a flag while
 * refresh always did, so a console that reads its rights from the claims was
 * blind until the first refresh — and which it was depended on timing.
 */
describe('the permissions a token carries', () => {
  let ctx: AuthContext

  beforeEach(async () => {
    ctx = await createAuthContext()
  })

  afterEach(async () => {
    await ctx.app.close()
  })

  const server = () => ctx.app.getHttpServer()

  const signIn = async (): Promise<protocol.OtpSignInResponse> => {
    await request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: LOGIN })
      .expect(200)

    const response = await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login: LOGIN, otp: ctx.mail.last.context.code })
      .expect(201)

    return response.body as protocol.OtpSignInResponse
  }

  /** A role in a school, so there is something for the claim to carry. */
  const giveRole = async (): Promise<string> => {
    const ds = ctx.app.get(DataSource)
    const user = await ds.getRepository(User).findOneBy({ email: LOGIN })
    const school = await ds.query('INSERT INTO schools (name) VALUES ($1) RETURNING id', ['S'])
    const role = await ds.getRepository(Role).save({
      name: 'Owner',
      description: 'Owner of the school',
      schoolId: school[0].id,
      permissions: ['schools:read'],
    })

    await ds.createQueryBuilder().relation(User, 'roles').of(user.id).add(role.id)

    return school[0].id
  }

  it('puts them in the token the moment a person signs in', async () => {
    await signIn()
    const schoolId = await giveRole()

    const claims = claimsOf((await signIn()).accessToken)

    expect(claims.permissions).toEqual([{ sid: schoolId, p: ['schools:read'] }])
  })

  it('hands out the same claim at the refresh door as at the sign-in door', async () => {
    await signIn()
    await giveRole()

    const signedIn = await signIn()
    const refreshed = await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: signedIn.refreshToken })
      .expect(200)

    expect(
      claimsOf((refreshed.body as protocol.RefreshTokensResponse).accessToken).permissions,
    ).toEqual(claimsOf(signedIn.accessToken).permissions)
  })

  it('carries an empty list for someone who holds no role, not nothing at all', async () => {
    const claims = claimsOf((await signIn()).accessToken)

    expect(claims.permissions).toEqual([])
  })

  /**
   * What the claim buys, and the reason the guard reads it instead of asking
   * the database on every request: the rights a token was minted with are the
   * rights it keeps. A role granted after it was issued arrives at the next
   * refresh, not mid-session.
   */
  it('is what the guard goes by, so a role granted later waits for the next token', async () => {
    const stale = await signIn()
    const schoolId = await giveRole()

    await request(server())
      .get(routes.edu.schools.find())
      .auth(stale.accessToken, { type: 'bearer' })
      .expect(403)

    const refreshed = await request(server())
      .post(routes.auth.tokens.refresh())
      .send({ refreshToken: stale.refreshToken })
      .expect(200)

    const body = refreshed.body as protocol.RefreshTokensResponse

    expect(claimsOf(body.accessToken).permissions).toEqual([{ sid: schoolId, p: ['schools:read'] }])
    await request(server())
      .get(routes.edu.schools.find())
      .auth(body.accessToken, { type: 'bearer' })
      .expect(200)
  })

  /**
   * The one way a token without the claim still reaches the guard: it was
   * minted by the build before this one and has not expired yet. It is served
   * from the database rather than refused, so a deploy does not answer 403 to
   * everyone holding one.
   */
  it('still serves a token minted before the claim was mandatory', async () => {
    await signIn()
    await giveRole()

    const ds = ctx.app.get(DataSource)
    const user = await ds.getRepository(User).findOneBy({ email: LOGIN })
    const jwt = ctx.app.get(JwtService)
    const config = ctx.app.get<{ secret: string }>(JwtConfig.KEY)

    const legacy = await jwt.signAsync(
      { jti: randomUUID(), sub: user.id, typ: 'access' },
      { secret: config.secret, expiresIn: '1h' },
    )

    await request(server())
      .get(routes.edu.schools.find())
      .auth(legacy, { type: 'bearer' })
      .expect(200)
  })
})
