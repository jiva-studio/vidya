import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { SchoolId, StorageProfileId } from '@vidya/domain'

import { StorageFailedError } from '../../storageFailure'
import { SecretSealingService } from '../secretSealing.service'

type Config = ConfigType<typeof MediaConfig>

const OLD_KEY = Buffer.alloc(32, 3)
const NEW_KEY = Buffer.alloc(32, 9)

const SCHOOL = '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' as SchoolId
const PROFILE = 'e5f60718-293a-4b45-cd6e-7f8091021324' as StorageProfileId
const SECRET = 'd41d8cd9-8f00-b204-e980-0998ecf8427e'

const scope = { schoolId: SCHOOL, profileId: PROFILE }

/**
 * The installation's master keys, held by version.
 *
 * `keyVersion` names the one new documents are sealed under; the rest stay
 * because the documents that name them have not been rewrapped yet. The single
 * `masterKey` is carried alongside so the service under test always has the
 * current key by whichever name it reads it.
 */
const installationWith = (keys: Record<number, Buffer>, keyVersion: number): SecretSealingService =>
  new SecretSealingService({
    masterKeys: keys,
    masterKey: keys[keyVersion],
    keyVersion,
  } as unknown as Config)

describe('a master key rotated under sealed credentials', () => {
  it('still opens a document sealed under the key that has been replaced', () => {
    const before = installationWith({ 1: OLD_KEY }, 1)
    const sealed = before.sealProfile({ secret: SECRET }, scope)

    const after = installationWith({ 1: OLD_KEY, 2: NEW_KEY }, 2)

    expect(after.openSecret(sealed, scope)).toBe(SECRET)
  })

  it('seals what arrives after the rotation under the new key, not the old one', () => {
    const after = installationWith({ 1: OLD_KEY, 2: NEW_KEY }, 2)

    const sealed = after.sealProfile({ secret: SECRET }, scope)

    expect(sealed.keyVersion).toBe(2)
    expect(() => installationWith({ 1: OLD_KEY }, 1).openSecret(sealed, scope)).toThrow(
      StorageFailedError,
    )
  })

  // The document says which key wrapped it; opening it with whichever key
  // happens to be current is how a rotation silently stops being possible.
  it('opens a document with the key its own version names', () => {
    const before = installationWith({ 1: OLD_KEY }, 1)
    const old = before.sealProfile({ secret: SECRET }, scope)
    const after = installationWith({ 1: OLD_KEY, 2: NEW_KEY }, 2)
    const fresh = after.sealProfile({ secret: 'the-new-zone-password' }, scope)

    expect(old.keyVersion).toBe(1)
    expect(fresh.keyVersion).toBe(2)
    expect(after.openSecret(old, scope)).toBe(SECRET)
    expect(after.openSecret(fresh, scope)).toBe('the-new-zone-password')
  })

  it('refuses a version no installed key answers to, rather than reaching for the current one', () => {
    const after = installationWith({ 1: OLD_KEY, 2: NEW_KEY }, 2)
    const sealed = after.sealProfile({ secret: SECRET }, scope)

    expect(() => after.openSecret({ ...sealed, keyVersion: 99 }, scope)).toThrow(StorageFailedError)
  })

  it('names no secret when it refuses an unknown version', () => {
    const after = installationWith({ 1: OLD_KEY, 2: NEW_KEY }, 2)
    const sealed = after.sealProfile({ secret: SECRET }, scope)

    try {
      after.openSecret({ ...sealed, keyVersion: 99 }, scope)
      throw new Error('the document opened under a version nothing holds')
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(SECRET)
      expect(String((error as Error).message)).toBe('storage-secret-unreadable')
    }
  })
})
