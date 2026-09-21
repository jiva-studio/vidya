import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { createStorageContext, refusalFor, StorageContext, TEST_MASTER_KEY } from './context'

const ROUTE = 'PUT /edu/schools/:schoolId/storage'

/**
 * An endpoint the API would refuse to reach, and the reason it is refused.
 *
 * Raw addresses are used rather than names that resolve to them: a suite cannot
 * control DNS, and the address form is what the check has to catch either way.
 */
const REFUSED_ENDPOINTS: readonly [string, string][] = [
  ['http://de-s3.storage.bunnycdn.com', 'plain http, which anyone on the path can read'],
  ['https://10.0.0.5', 'a private address in 10/8'],
  ['https://172.16.4.9', 'a private address in 172.16/12'],
  ['https://192.168.1.10', 'a private address in 192.168/16'],
  ['https://127.0.0.1:9000', 'loopback, which is our own process'],
  ['https://169.254.169.254', 'the cloud metadata service'],
  ['https://100.64.0.1', 'a CGNAT address'],
  ['https://[::1]', 'IPv6 loopback'],
  ['https://[fc00::1]', 'an IPv6 unique local address'],
  ['https://storage.not-on-the-allowlist.example', 'a host the installation never allowed'],
]

describe('the endpoints a school is not allowed to point us at', () => {
  let app: INestApplication
  let ctx: StorageContext

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    ctx = await createStorageContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const put = async (endpoint: string) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send({ ...ctx.credentialsFor(ctx.one.school.id), endpoint })

  for (const [endpoint, reason] of REFUSED_ENDPOINTS) {
    it(`refuses ${endpoint} — ${reason}`, async () => {
      const refusal = refusalFor(ROUTE, MediaRefusals.endpointRejected)

      const response = await put(endpoint)

      expect(response.status).toBe(refusal.status)
      expect(response.body.message).toEqual([MediaRefusals.endpointRejected])
    })
  }

  // A request that was attempted and failed comes back as `storage-unreachable`
  // (502). Arriving as `storage-endpoint-rejected` instead is what says the
  // address was refused before anything was sent to it.
  it('sends nothing to a refused endpoint and leaves no profile behind', async () => {
    for (const [endpoint] of REFUSED_ENDPOINTS) {
      const response = await put(endpoint)

      expect(response.status).toBe(422)
      expect(response.body.message).not.toContain(MediaRefusals.storageUnreachable)
    }

    await expect(ctx.profileRows(ctx.one.school.id)).resolves.toEqual([])
    await expect(ctx.currentProfileIdOf(ctx.one.school.id)).resolves.toBeNull()
  })

  it('accepts a host on the allowlist of suffixes', async () => {
    const response = await put('https://s3.eu-central-1.amazonaws.com')

    expect(response.status).toBe(200)
  })
})
