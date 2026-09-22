import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { AddressResolverPort, MEDIA_ADDRESS_RESOLVER } from '@vidya/api/media/infra'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { createStorageContext, StorageContext, TEST_MASTER_KEY } from './context'

// TEST-NET-3, reserved for documentation and routed nowhere.
const PUBLIC_ADDRESS = '203.0.113.10'
const METADATA_ADDRESS = '169.254.169.254'

/**
 * A resolver whose answer the suite changes between requests, standing in for a
 * name whose owner re-points it.
 */
class RepointableResolver implements AddressResolverPort {
  address = PUBLIC_ADDRESS

  async resolveAddresses(): Promise<string[]> {
    return [this.address]
  }
}

describe('a storage host re-pointed after it was approved', () => {
  let app: INestApplication
  let ctx: StorageContext
  let resolver: RepointableResolver

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    resolver = new RepointableResolver()
    app = await createTestingApp([{ provide: MEDIA_ADDRESS_RESOLVER, useValue: resolver }])
    ctx = await createStorageContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const configure = async () =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send(ctx.credentialsFor(ctx.one.school.id))

  const verify = async () =>
    request(app.getHttpServer())
      .post(Routes().edu.schools.storage.verify(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))

  it('is accepted while the name still answers with a public address', async () => {
    await expect(configure().then((response) => response.status)).resolves.toBe(200)
  })

  it('is refused at verify once the name answers with the metadata service', async () => {
    await configure()
    resolver.address = METADATA_ADDRESS

    const response = await verify()

    expect(response.status).toBe(422)
    expect(response.body.message).toEqual([MediaRefusals.endpointRejected])
  })

  it('is not dialled at all by the verify that refused it', async () => {
    await configure()
    const before = ctx.storageCalls().length
    resolver.address = METADATA_ADDRESS

    await verify()

    expect(ctx.storageCalls()).toHaveLength(before)
  })

  it('refuses a private address the name has been moved to, not only the metadata one', async () => {
    await configure()
    resolver.address = '10.0.0.5'

    const response = await verify()

    expect(response.body.message).toEqual([MediaRefusals.endpointRejected])
  })
})
