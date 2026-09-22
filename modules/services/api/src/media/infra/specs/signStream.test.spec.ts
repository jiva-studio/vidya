import { MediaStoragePort, ReadWindowSeconds, StorageDelivery, windowExpiry } from '@vidya/domain'
import { MediaRefusals } from '@vidya/protocol'

import { StorageFailedError } from '../../storageFailure'
import { acceptedCredentials } from '../fixtureCredentials'
import { InMemoryStorage } from '../inMemoryStorage'
import { StorageCredentials } from '../ports'
import { S3StorageFactory } from '../s3Storage'

const PREFIX = 'school/one/video/lecture'

/** A profile and the way it delivers reads, which is what decides a stream. */
const profileDelivering = (delivery: StorageDelivery): StorageCredentials =>
  ({
    endpoint: 'https://storage.invalid',
    region: 'us-east-1',
    bucket: 'vidya-demo',
    prefix: 'school/one',
    delivery,
    ...acceptedCredentials(),
  }) as StorageCredentials

const drivers: [string, (credentials: StorageCredentials) => MediaStoragePort][] = [
  [
    'the in-memory port the suites run on',
    (credentials) => new InMemoryStorage().openStorage(credentials),
  ],
  [
    'the S3 port a school is reached through',
    (credentials) => new S3StorageFactory().openStorage(credentials),
  ],
]

/** What a caller is handed instead of a signature, refusal or anything else. */
const refusedBy = async (storage: MediaStoragePort): Promise<unknown> => {
  try {
    await storage.signStream(PREFIX, 'video')
    return undefined
  } catch (thrown) {
    return thrown
  }
}

describe.each(drivers)('signing a stream: %s', (_name, open) => {
  it('refuses a presigned profile with a key a screen can show', async () => {
    const refused = await refusedBy(open(profileDelivering('presigned')))

    expect(refused).toBeInstanceOf(StorageFailedError)
    expect(Object.values(MediaRefusals)).toContain((refused as StorageFailedError).refusal)
  })

  it('does not answer a profile delivered by a CDN with the presigned refusal', async () => {
    const presigned = await refusedBy(open(profileDelivering('presigned')))
    const throughCdn = await refusedBy(open(profileDelivering('bunny-token')))

    expect((throughCdn as StorageFailedError)?.message).not.toBe(
      (presigned as StorageFailedError).message,
    )
  })

  it('still signs a single object, which is all a presigned profile can do', async () => {
    const at = Date.now()
    const signed = await open(profileDelivering('presigned')).signRead(
      `${PREFIX}/original.mp4`,
      'video',
    )

    expect(signed.url).toMatch(/^[a-z0-9+.-]+:\/\//i)
    expect(signed.url).toContain('original.mp4')
    expect(Date.parse(signed.expiresAt)).toBe(windowExpiry(at, ReadWindowSeconds.video))
  })
})
