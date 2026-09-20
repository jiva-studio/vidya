import { User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { AuthContext, createAuthContext } from './context'

const routes = protocol.Routes()
const LOGIN = 'student@example.com'

const claimsOf = (token: string): protocol.AccessToken =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())

/**
 * The device keys every local table by owner, and a session deliberately stores
 * no identity, so this endpoint is the only place the owner can come from.
 */
describe('GET /auth/profile', () => {
  let ctx: AuthContext

  beforeEach(async () => {
    ctx = await createAuthContext()
  })

  afterEach(async () => {
    await ctx.app.close()
  })

  const server = () => ctx.app.getHttpServer()

  const signIn = async (login = LOGIN): Promise<protocol.OtpSignInResponse> => {
    await request(server())
      .post(routes.otp.root())
      .send({ type: 'email', destination: login })
      .expect(200)

    const response = await request(server())
      .post(routes.auth.signIn('otp'))
      .send({ login, otp: ctx.mail.last.context.code })
      .expect(201)

    return response.body as protocol.OtpSignInResponse
  }

  const profile = (token: string) =>
    request(server()).get(routes.auth.profile()).auth(token, { type: 'bearer' })

  it('names the person the token was issued to', async () => {
    const tokens = await signIn()

    const body = (await profile(tokens.accessToken).expect(200)).body as protocol.GetProfileResponse

    expect(body.email).toBe(LOGIN)
  })

  /**
   * The equality the device is built on: `userId` becomes the owner column of
   * every local row, and the rows the server hands back are scoped to the
   * token's subject. If these two ever named different people, a device would
   * file one person's rows under another and no request would fail.
   */
  it('answers with the subject of the token and nobody else', async () => {
    const tokens = await signIn()

    const body = (await profile(tokens.accessToken).expect(200)).body as protocol.GetProfileResponse

    expect(body.userId).toBe(claimsOf(tokens.accessToken).sub)
  })

  it('does not hand the profile of one person to the token of another', async () => {
    const mine = await signIn()
    const theirs = await signIn('someone-else@example.com')

    const body = (await profile(theirs.accessToken).expect(200)).body as protocol.GetProfileResponse

    expect(body.userId).not.toBe(claimsOf(mine.accessToken).sub)
    expect(body.email).toBe('someone-else@example.com')
  })

  /**
   * The mobile app shows the profile wizard on `!profile.name`, so an unnamed
   * person has to arrive as an absent key rather than as an empty string.
   */
  it('leaves the name out until there is one, which is what asks for the wizard', async () => {
    const tokens = await signIn()

    const body = (await profile(tokens.accessToken).expect(200)).body as protocol.GetProfileResponse

    expect(body.name).toBeUndefined()
  })

  it('hands the name over once it is filled in', async () => {
    const tokens = await signIn()
    const ds = ctx.app.get(DataSource)
    await ds.getRepository(User).update({ email: LOGIN }, { name: 'Ananda' })

    const body = (await profile(tokens.accessToken).expect(200)).body as protocol.GetProfileResponse

    expect(body.name).toBe('Ananda')
  })

  it('refuses a caller with no token, rather than answering 404', () =>
    request(server()).get(routes.auth.profile()).expect(401))

  it('refuses a refresh token used in place of an access token', async () => {
    const tokens = await signIn()

    return profile(tokens.refreshToken).expect(401)
  })
})
