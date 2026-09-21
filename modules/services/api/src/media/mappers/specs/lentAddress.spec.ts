import { StorageProfile } from '@vidya/entities'

import { hasOwnCredentials, toStorageProfileView } from '../storageProfile.mapper'

const occupancy = { usedBytes: 2048, quotaBytes: 5_368_709_120 }

const bunnyRow = (overrides: Partial<StorageProfile> = {}): StorageProfile =>
  ({
    id: 'e5f60718-293a-4b45-cd6e-7f8091021324',
    schoolId: '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    provider: 'bunny',
    endpoint: null,
    r2AccountId: null,
    region: 'de',
    bucket: 'vidya-installation',
    prefix: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f',
    accessKeyId: 'installation-key',
    delivery: 'public',
    publicBaseUrl: 'https://cdn.installation.example',
    verifiedAt: null,
    verifyError: null,
    retiredAt: null,
    ...overrides,
  }) as unknown as StorageProfile

describe('the address of storage a school was lent', () => {
  // The column is empty for every provider whose host we compose, so masking
  // the column alone would still put the installation's host on the wire.
  it('masks the host that was composed, not merely the one that was typed', () => {
    const view = toStorageProfileView(bunnyRow(), '427e', occupancy)

    expect(view.endpoint).toBe('')
    expect(JSON.stringify(view)).not.toContain('storage.bunnycdn.com')
  })

  it('names the composed host once the school has proved keys of its own', () => {
    const own = bunnyRow({ verifiedAt: new Date('2026-09-21T12:00:00.000Z') })

    expect(toStorageProfileView(own, '427e', occupancy).endpoint).toBe(
      'https://de-s3.storage.bunnycdn.com',
    )
  })
})

describe('whose credentials a school stores behind', () => {
  it('counts a school with no profile as storing behind the installation', () => {
    expect(hasOwnCredentials(null)).toBe(false)
  })

  it('counts a probed profile as the school own, and an unprobed one as lent', () => {
    expect(hasOwnCredentials(bunnyRow({ verifiedAt: new Date() }))).toBe(true)
    expect(hasOwnCredentials(bunnyRow({ verifyError: 'storage-credentials-rejected' }))).toBe(true)
    expect(hasOwnCredentials(bunnyRow())).toBe(false)
  })
})
