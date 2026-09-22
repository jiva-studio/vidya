import { StorageFailedError } from '../../storageFailure'
import { hasOwnEndpoint, storageEndpointFor } from '../storageAddress'

describe('the address of a provider we drive', () => {
  it('composes the AWS host from the region', () => {
    expect(storageEndpointFor('aws', { region: 'eu-central-1' })).toBe(
      'https://s3.eu-central-1.amazonaws.com',
    )
  })

  it('composes the Bunny host from the storage zone region', () => {
    expect(storageEndpointFor('bunny', { region: 'de' })).toBe('https://de-s3.storage.bunnycdn.com')
  })

  it('composes the R2 host from the account, which is not the region', () => {
    expect(storageEndpointFor('r2', { region: 'auto', r2AccountId: 'a1b2c3d4e5' })).toBe(
      'https://a1b2c3d4e5.r2.cloudflarestorage.com',
    )
  })

  it('takes the address a school typed for storage that is merely compatible', () => {
    expect(
      storageEndpointFor('s3-compatible', { region: 'us-east-1', endpoint: 'https://minio.local' }),
    ).toBe('https://minio.local')
  })
})

describe('what a named provider was not asked for', () => {
  it('refuses an address, so nothing is proved against a host we did not compose', () => {
    expect(() =>
      storageEndpointFor('aws', { region: 'eu-central-1', endpoint: 'https://attacker.example' }),
    ).toThrow(StorageFailedError)
    expect(() =>
      storageEndpointFor('bunny', { region: 'de', endpoint: 'https://attacker.example' }),
    ).toThrow(StorageFailedError)
    expect(() =>
      storageEndpointFor('r2', {
        region: 'auto',
        r2AccountId: 'a1b2c3d4e5',
        endpoint: 'https://attacker.example',
      }),
    ).toThrow(StorageFailedError)
  })

  // An account that names no part of the host it was sent with leaves the
  // school and the profile disagreeing about which bucket was reached.
  it('refuses an account from a provider that does not address by one', () => {
    expect(() =>
      storageEndpointFor('aws', { region: 'eu-central-1', r2AccountId: 'a1b2' }),
    ).toThrow(StorageFailedError)
    expect(() =>
      storageEndpointFor('s3-compatible', {
        region: 'de',
        r2AccountId: 'a1b2',
        endpoint: 'https://minio.local',
      }),
    ).toThrow(StorageFailedError)
  })
})

describe('what a provider is given instead of a host', () => {
  it('has to be a single label, so a region cannot carry a host of its own', () => {
    expect(() => storageEndpointFor('aws', { region: 'eu-central-1.attacker.example' })).toThrow(
      StorageFailedError,
    )
    expect(() => storageEndpointFor('bunny', { region: 'de/../' })).toThrow(StorageFailedError)
    expect(() => storageEndpointFor('r2', { region: 'auto', r2AccountId: 'account:8080' })).toThrow(
      StorageFailedError,
    )
  })

  it('has to be there at all', () => {
    expect(() => storageEndpointFor('aws', { region: '' })).toThrow(StorageFailedError)
    expect(() => storageEndpointFor('r2', { region: 'auto' })).toThrow(StorageFailedError)
    expect(() => storageEndpointFor('s3-compatible', { region: 'de' })).toThrow(StorageFailedError)
    expect(() => storageEndpointFor('s3-compatible', { region: 'de', endpoint: null })).toThrow(
      StorageFailedError,
    )
  })
})

describe('which addresses the allowlist has to police', () => {
  it('is the one a school typed, because the others resolve to hosts we wrote', () => {
    expect(hasOwnEndpoint('s3-compatible')).toBe(true)
    expect(hasOwnEndpoint('aws')).toBe(false)
    expect(hasOwnEndpoint('bunny')).toBe(false)
    expect(hasOwnEndpoint('r2')).toBe(false)
  })
})
