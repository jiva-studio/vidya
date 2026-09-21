import { MediaStoragePort } from '@vidya/domain'

import { acceptedCredentials } from '../fixtureCredentials'
import { InMemoryStorage } from '../inMemoryStorage'
import { StorageCredentials } from '../ports'
import { S3StorageFactory } from '../s3Storage'

/**
 * A profile with no CDN host of its own, which is what `presigned` delivery is:
 * the storage endpoint signs, and it signs one object at a time.
 */
const presignedProfile = (): StorageCredentials => ({
  endpoint: 'https://storage.invalid',
  region: 'us-east-1',
  bucket: 'vidya-demo',
  prefix: 'school/one',
  ...acceptedCredentials(),
})

const drivers: [string, () => MediaStoragePort][] = [
  [
    'the in-memory port the suites run on',
    () => new InMemoryStorage().openStorage(presignedProfile()),
  ],
  [
    'the S3 port a school is reached through',
    () => new S3StorageFactory().openStorage(presignedProfile()),
  ],
]

describe.each(drivers)('signing a stream on a presigned profile: %s', (_name, open) => {
  it('refuses the prefix rather than signing the manifest alone', async () => {
    await expect(open().signStream('school/one/video/lecture', 'video')).rejects.toThrow()
  })

  it('still signs a single object, which is all this delivery can do', async () => {
    const signed = await open().signRead('school/one/video/lecture/original.mp4', 'video')

    expect(signed.url).toBeTruthy()
    expect(signed.expiresAt).toBeTruthy()
  })
})
