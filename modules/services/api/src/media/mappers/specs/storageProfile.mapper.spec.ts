import { StorageProfile } from '@vidya/entities'

import { deliveryFor, secretTailOf, toStorageProfileView } from '../storageProfile.mapper'

describe('how a profile delivers reads', () => {
  it('signs from the storage endpoint when no CDN host was given', () => {
    expect(deliveryFor(null, 'a-token-secret')).toBe('presigned')
    expect(deliveryFor(undefined, undefined)).toBe('presigned')
    expect(deliveryFor('', 'a-token-secret')).toBe('presigned')
  })

  it('signs at the CDN when a host came with a token secret', () => {
    expect(deliveryFor('https://cdn.example', 'a-token-secret')).toBe('bunny-token')
  })

  it('serves openly when a host came without one, rather than pretending to sign', () => {
    expect(deliveryFor('https://cdn.example', undefined)).toBe('public')
    expect(deliveryFor('https://cdn.example', '')).toBe('public')
  })
})

describe('the tail of a secret', () => {
  it('is the last four characters, which tells two credentials apart', () => {
    expect(secretTailOf('d41d8cd98f00b204e9800998ecf8427e')).toBe('427e')
  })

  it('is the whole of a secret shorter than four, and still not more than it', () => {
    expect(secretTailOf('ab')).toBe('ab')
  })
})

describe('the profile as it goes on the wire', () => {
  const profile = {
    id: 'e5f60718-293a-4b45-cd6e-7f8091021324',
    schoolId: '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    provider: 's3-compatible',
    endpoint: 'https://de-s3.storage.bunnycdn.com',
    r2AccountId: null,
    region: 'de',
    bucket: 'vidya-demo',
    prefix: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    accessKeyId: 'vidya-demo',
    secrets: {
      keyVersion: 1,
      dek: { ciphertext: 'c2VhbGVkLWRlaw==', nonce: 'ZGVrLW5vbmNl' },
      secret: { ciphertext: 'c2VhbGVk', nonce: 'bm9uY2U=' },
      tokenSecret: { ciphertext: 'c2VhbGVkLXRva2Vu', nonce: 'dG9rZW4tbm9uY2U=' },
    },
    delivery: 'bunny-token',
    publicBaseUrl: 'https://cdn.demo-school.example',
    verifiedAt: new Date('2026-09-21T12:00:03.880Z'),
    verifyError: null,
    retiredAt: null,
    createdAt: new Date('2026-09-21T12:00:00.000Z'),
    updatedAt: new Date('2026-09-21T12:00:03.880Z'),
  } as unknown as StorageProfile

  const occupancy = { usedBytes: 402118, quotaBytes: 53687091200 }

  it('carries nothing sealed, and no field that holds a secret', () => {
    const view = toStorageProfileView(profile, '427e', occupancy) as unknown as Record<
      string,
      unknown
    >

    expect(Object.keys(view).filter((key) => /cipher|nonce|dek|secrets?$/i.test(key))).toEqual([])
    expect(JSON.stringify(view)).not.toContain('c2VhbGVk')
  })

  it('answers the tail it was given and no more of the secret', () => {
    expect(toStorageProfileView(profile, '427e', occupancy).secretTail).toBe('427e')
  })

  // What a school occupies and what it may occupy are not on the profile: one
  // is the sum of its files, the other its own policy row.
  it('counts bytes as numbers, from what it was handed beside the profile', () => {
    const view = toStorageProfileView(profile, '427e', occupancy)

    expect(view.quotaBytes).toBe(53687091200)
    expect(view.usedBytes).toBe(402118)
  })

  it('says a school has no quota rather than a quota of zero', () => {
    const view = toStorageProfileView(profile, '427e', { usedBytes: 0, quotaBytes: null })

    expect(view.quotaBytes).toBeNull()
  })

  // The screen answers "where do this school's files live", and a school on a
  // named provider has an address like any other — we composed it, so we are
  // the ones who can say it.
  it('names the provider and the host its files are actually at', () => {
    expect(toStorageProfileView(profile, '427e', occupancy)).toMatchObject({
      provider: 's3-compatible',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
    })

    const named = {
      ...profile,
      provider: 'bunny',
      region: 'de',
      endpoint: null,
    } as unknown as StorageProfile

    expect(toStorageProfileView(named, '427e', occupancy)).toMatchObject({
      provider: 'bunny',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
    })

    const r2 = {
      ...profile,
      provider: 'r2',
      region: 'auto',
      r2AccountId: 'a1b2c3d4e5',
      endpoint: null,
    } as unknown as StorageProfile

    expect(toStorageProfileView(r2, '427e', occupancy).endpoint).toBe(
      'https://a1b2c3d4e5.r2.cloudflarestorage.com',
    )
  })

  it('answers when the credentials were last proved, as an instant on the wire', () => {
    expect(toStorageProfileView(profile, '427e', occupancy).verifiedAt).toBe(
      '2026-09-21T12:00:03.880Z',
    )
    expect(
      toStorageProfileView({ ...profile, verifiedAt: null }, '427e', occupancy).verifiedAt,
    ).toBeNull()
  })
})
