import { StorageProfile } from '@vidya/entities'

import {
  deliveryFor,
  secretTailOf,
  toStorageProfileView,
  videoProviderOf,
} from '../storageProfile.mapper'

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
    kind: 's3',
    endpoint: 'https://de-s3.storage.bunnycdn.com',
    region: 'de',
    bucket: 'vidya-demo',
    prefix: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    accessKeyId: 'vidya-demo',
    secretCiphertext: Buffer.from('sealed'),
    secretNonce: Buffer.from('nonce'),
    keyVersion: 1,
    dekCiphertext: Buffer.from('sealed-dek'),
    dekNonce: Buffer.from('dek-nonce'),
    delivery: 'bunny-token',
    publicBaseUrl: 'https://cdn.demo-school.example',
    tokenSecretCiphertext: Buffer.from('sealed-token'),
    tokenSecretNonce: Buffer.from('token-nonce'),
    video: { kind: 'none' },
    quotaBytes: '53687091200',
    usedBytes: '402118',
    verifiedAt: new Date('2026-09-21T12:00:03.880Z'),
    verifyError: null,
    retiredAt: null,
    createdAt: new Date('2026-09-21T12:00:00.000Z'),
    updatedAt: new Date('2026-09-21T12:00:03.880Z'),
  } as unknown as StorageProfile

  it('carries nothing sealed, and no field that holds a secret', () => {
    const view = toStorageProfileView(profile, '427e') as unknown as Record<string, unknown>

    expect(Object.keys(view).filter((key) => /cipher|nonce|dek|secret$/i.test(key))).toEqual([])
    expect(JSON.stringify(view)).not.toContain('sealed')
  })

  it('answers the tail it was given and no more of the secret', () => {
    expect(toStorageProfileView(profile, '427e').secretTail).toBe('427e')
  })

  it('counts bytes as numbers, whichever way the driver hands them over', () => {
    const view = toStorageProfileView(profile, '427e')

    expect(view.quotaBytes).toBe(53687091200)
    expect(view.usedBytes).toBe(402118)
  })

  it('says a profile has no quota rather than a quota of zero', () => {
    const view = toStorageProfileView({ ...profile, quotaBytes: null }, '427e')

    expect(view.quotaBytes).toBeNull()
  })

  it('answers when the credentials were last proved, as an instant on the wire', () => {
    expect(toStorageProfileView(profile, '427e').verifiedAt).toBe('2026-09-21T12:00:03.880Z')
    expect(toStorageProfileView({ ...profile, verifiedAt: null }, '427e').verifiedAt).toBeNull()
  })
})

describe('the video provider a profile is given', () => {
  it('is none when the school named none', () => {
    expect(videoProviderOf(undefined)).toEqual({ kind: 'none' })
    expect(videoProviderOf({ kind: 'none' })).toEqual({ kind: 'none' })
  })

  it('is kept whole when a provider came with everything it needs', () => {
    expect(
      videoProviderOf({ kind: 'bunny-stream', libraryId: '42', pullZoneHost: 'vz.example' }),
    ).toEqual({ kind: 'bunny-stream', libraryId: '42', pullZoneHost: 'vz.example' })
  })

  // The column is json, so anything accepted here is read back as a provider
  // later; a half-filled one would fail at playback instead of at entry.
  it('falls back to none when the provider is missing a field', () => {
    expect(videoProviderOf({ kind: 'bunny-stream', libraryId: '42' } as never)).toEqual({
      kind: 'none',
    })
    expect(videoProviderOf({ kind: 'bunny-stream', pullZoneHost: 'vz.example' } as never)).toEqual({
      kind: 'none',
    })
  })

  it('falls back to none when a field is present but empty', () => {
    expect(
      videoProviderOf({ kind: 'bunny-stream', libraryId: '', pullZoneHost: 'vz.example' }),
    ).toEqual({ kind: 'none' })
  })

  it('falls back to none for a provider nobody has implemented', () => {
    expect(videoProviderOf({ kind: 'mux' } as never)).toEqual({ kind: 'none' })
  })

  it('keeps nothing beyond the fields a provider declares', () => {
    const kept = videoProviderOf({
      kind: 'bunny-stream',
      libraryId: '42',
      pullZoneHost: 'vz.example',
      apiKey: 'must-not-be-stored',
    } as never)

    expect(Object.keys(kept).sort()).toEqual(['kind', 'libraryId', 'pullZoneHost'])
  })
})
