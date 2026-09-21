import { Clock } from '@vidya/api/shared/clock'
import { MediaKind, MediaStoragePort, ReadWindowSeconds } from '@vidya/domain'

import { acceptedCredentials } from '../fixtureCredentials'
import { InMemoryStorage } from '../inMemoryStorage'
import { StorageCredentials } from '../ports'
import { S3StorageFactory } from '../s3Storage'

const credentials = (): StorageCredentials => ({
  endpoint: 'https://storage.invalid',
  region: 'us-east-1',
  bucket: 'vidya-demo',
  prefix: 'school/one',
  ...acceptedCredentials(),
})

/** Well inside an hour, so the boundary rounded to is a number and not a range. */
const NOON = Date.UTC(2026, 8, 21, 12, 17, 43, 512)

const HOUR_END = Date.UTC(2026, 8, 21, 13, 0, 0, 0)
const SIX_HOUR_END = Date.UTC(2026, 8, 21, 18, 0, 0, 0)

const fixed = (nowMs: number): Clock => ({ nowMs: () => nowMs })

const drivers: [string, (clock: Clock) => MediaStoragePort][] = [
  [
    'the in-memory port the suites run on',
    (clock) => new InMemoryStorage(clock).openStorage(credentials()),
  ],
  [
    'the S3 port a school is reached through',
    (clock) => new S3StorageFactory(clock).openStorage(credentials()),
  ],
]

const KEY = 'school/one/image/lecture/original.png'

describe.each(drivers)('the window a read signature is cut to: %s', (_name, open) => {
  it('expires at the end of the hour the clock is in, for an image', async () => {
    const signed = await open(fixed(NOON)).signRead(KEY, 'image')

    expect(signed.expiresAt).toBe(new Date(HOUR_END).toISOString())
  })

  it('expires at the end of the six hours the clock is in, for a video', async () => {
    const signed = await open(fixed(NOON)).signRead(KEY, 'video')

    expect(signed.expiresAt).toBe(new Date(SIX_HOUR_END).toISOString())
  })

  it('hands two askers inside one window the very same address', async () => {
    const early = await open(fixed(NOON)).signRead(KEY, 'image')
    const late = await open(fixed(HOUR_END - 1)).signRead(KEY, 'image')

    expect(late.url).toBe(early.url)
    expect(late.expiresAt).toBe(early.expiresAt)
  })

  it('hands the asker past the boundary a different address', async () => {
    const inside = await open(fixed(HOUR_END - 1)).signRead(KEY, 'image')
    const after = await open(fixed(HOUR_END + 1)).signRead(KEY, 'image')

    expect(after.url).not.toBe(inside.url)
    expect(after.expiresAt).not.toBe(inside.expiresAt)
  })
})

/**
 * What the query string has to say for a CDN to hold one copy: the signature is
 * dated from the window's own start and lives exactly one window, so every
 * reader inside it is handed the same bytes.
 */
describe('the signature S3 is asked for', () => {
  const signedQuery = async (kind: MediaKind, nowMs: number) => {
    const signed = await new S3StorageFactory(fixed(nowMs))
      .openStorage(credentials())
      .signRead(KEY, kind)

    return new URL(signed.url).searchParams
  }

  it('is dated from the start of the window rather than from the moment it was asked for', async () => {
    const query = await signedQuery('image', NOON)

    expect(query.get('X-Amz-Date')).toBe('20260921T120000Z')
  })

  it('lives the whole window and not the remainder of it', async () => {
    const query = await signedQuery('video', NOON)

    expect(query.get('X-Amz-Expires')).toBe(String(ReadWindowSeconds.video))
    expect(query.get('X-Amz-Date')).toBe('20260921T120000Z')
  })
})

describe('the grant an upload is given', () => {
  it('expires a quarter of an hour after the clock, not at a window boundary', async () => {
    const grant = await new InMemoryStorage(fixed(NOON))
      .openStorage(credentials())
      .signUpload(KEY, { contentType: 'image/png', sizeBytes: 2048 })

    expect(grant.expiresAt).toBe(new Date(NOON + 900_000).toISOString())
  })
})
