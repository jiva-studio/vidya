import { StorageProfile } from '@vidya/entities'

import { isLentProfile, toStorageProfileView } from '../storageProfile.mapper'

const row = (overrides: Partial<StorageProfile> = {}): StorageProfile =>
  ({
    id: 'e5f60718-293a-4b45-cd6e-7f8091021324',
    schoolId: '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    kind: 's3',
    endpoint: 'https://de-s3.storage.bunnycdn.com',
    region: 'de',
    bucket: 'vidya-installation',
    prefix: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    accessKeyId: 'installation-key',
    delivery: 'public',
    publicBaseUrl: 'https://cdn.installation.example',
    video: { kind: 'none' },
    quotaBytes: '5368709120',
    usedBytes: '2048',
    verifiedAt: null,
    verifyError: null,
    retiredAt: null,
    ...overrides,
  }) as unknown as StorageProfile

describe('telling a lent profile from one the school brought', () => {
  it('reads a row that has never been probed as lent', () => {
    expect(isLentProfile(row())).toBe(true)
  })

  it('reads a row whose keys were proved as the school own', () => {
    expect(isLentProfile(row({ verifiedAt: new Date('2026-09-21T12:00:00.000Z') }))).toBe(false)
  })

  // A school whose probe failed still brought the keys, and has to be shown
  // them to correct them.
  it('reads a row whose probe was refused as the school own', () => {
    expect(isLentProfile(row({ verifyError: 'storage-credentials-rejected' }))).toBe(false)
  })
})

describe('reading back a profile on the storage of the installation', () => {
  const view = toStorageProfileView(row(), '427e')

  it('says it is lent', () => {
    expect(view.lent).toBe(true)
  })

  it('names neither the bucket of the installation nor the key that opens it', () => {
    expect(view.endpoint).toBe('')
    expect(view.bucket).toBe('')
    expect(view.accessKeyId).toBe('')
    expect(view.secretTail).toBe('')
  })

  // The client renders one form for both answers, so a masked field is blank
  // rather than missing or null.
  it('keeps every masked field present and a string', () => {
    for (const field of ['endpoint', 'bucket', 'accessKeyId', 'secretTail'] as const) {
      expect(Object.keys(view)).toContain(field)
      expect(typeof view[field]).toBe('string')
    }
  })

  it('keeps what the school can act on, and where its files are served from', () => {
    expect(view.publicBaseUrl).toBe('https://cdn.installation.example')
    expect(view.prefix).toBe('school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f')
    expect(view.quotaBytes).toBe(5368709120)
    expect(view.usedBytes).toBe(2048)
    expect(view.delivery).toBe('public')
  })
})

describe('reading back a profile the school brought itself', () => {
  const view = toStorageProfileView(
    row({ bucket: 'vidya-demo', verifiedAt: new Date('2026-09-21T12:00:00.000Z') }),
    '427e',
  )

  it('says it is not lent, and hides none of it', () => {
    expect(view.lent).toBe(false)
    expect(view.endpoint).toBe('https://de-s3.storage.bunnycdn.com')
    expect(view.bucket).toBe('vidya-demo')
    expect(view.accessKeyId).toBe('installation-key')
    expect(view.secretTail).toBe('427e')
  })
})
