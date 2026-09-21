import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { SchoolId, StorageProfileId } from '@vidya/domain'

import { StorageFailedError } from '../../storageFailure'
import { SealedProfile, SealedRow, SecretSealingService } from '../secretSealing.service'

type Config = ConfigType<typeof MediaConfig>

const sealingWith = (masterKey: Buffer | null, keyVersion = 1): SecretSealingService =>
  new SecretSealingService({ masterKey, keyVersion } as Config)

const SCHOOL = '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' as SchoolId
const OTHER_SCHOOL = '11111111-2222-3333-4444-555555555555' as SchoolId
const PROFILE = 'e5f60718-293a-4b45-cd6e-7f8091021324' as StorageProfileId
const OTHER_PROFILE = '99999999-8888-7777-6666-555555555555' as StorageProfileId

const SECRET = 'd41d8cd9-8f00-b204-e980-0998ecf8427e'

const rowOf = (sealed: SealedProfile): SealedRow => ({
  keyVersion: sealed.keyVersion,
  dekCiphertext: sealed.dek.ciphertext,
  dekNonce: sealed.dek.nonce,
  secretCiphertext: sealed.secret.ciphertext,
  secretNonce: sealed.secret.nonce,
})

describe('sealing a school storage secret', () => {
  const master = Buffer.alloc(32, 3)
  const scope = { schoolId: SCHOOL, profileId: PROFILE }

  it('gives back the secret it was handed, for the row it was sealed for', () => {
    const sealing = sealingWith(master)

    const sealed = sealing.sealProfile({ secret: SECRET }, scope)

    expect(sealing.openSecret(rowOf(sealed), scope)).toBe(SECRET)
  })

  it('keeps the secret out of the ciphertext it produces', () => {
    const sealed = sealingWith(master).sealProfile({ secret: SECRET }, scope)

    expect(sealed.secret.ciphertext.toString('utf8')).not.toContain(SECRET)
    expect(sealed.secret.ciphertext.toString('latin1')).not.toContain(SECRET)
  })

  it('seals the same secret differently every time, so two rows never match', () => {
    const sealing = sealingWith(master)

    const first = sealing.sealProfile({ secret: SECRET }, scope)
    const second = sealing.sealProfile({ secret: SECRET }, scope)

    expect(first.secret.nonce.equals(second.secret.nonce)).toBe(false)
    expect(first.secret.ciphertext.equals(second.secret.ciphertext)).toBe(false)
  })

  // One data key shared between profiles would make a stolen row readable with
  // any other row's wrapped key, which is the whole reason each has its own.
  it('gives every profile its own data key, so one row key does not open another', () => {
    const sealing = sealingWith(master)
    const mine = sealing.sealProfile({ secret: SECRET }, scope)
    const theirs = sealing.sealProfile({ secret: SECRET }, scope)

    const withTheirKey = {
      ...rowOf(mine),
      dekCiphertext: theirs.dek.ciphertext,
      dekNonce: theirs.dek.nonce,
    }

    expect(() => sealing.openSecret(withTheirKey, scope)).toThrow(StorageFailedError)
  })

  it('seals a token secret beside the secret, and only when one was given', () => {
    const sealing = sealingWith(master)

    expect(sealing.sealProfile({ secret: SECRET }, scope).tokenSecret).toBeNull()
    expect(
      sealing.sealProfile({ secret: SECRET, tokenSecret: 'token' }, scope).tokenSecret,
    ).not.toBeNull()
  })

  it('records which master key wrapped the data key', () => {
    const sealed = sealingWith(master, 7).sealProfile({ secret: SECRET }, scope)

    expect(sealed.keyVersion).toBe(7)
  })
})

describe('a sealed secret read somewhere it was not sealed for', () => {
  const master = Buffer.alloc(32, 3)
  const scope = { schoolId: SCHOOL, profileId: PROFILE }

  it('does not open in another profile of the same school', () => {
    const sealing = sealingWith(master)
    const sealed = sealing.sealProfile({ secret: SECRET }, scope)

    expect(() =>
      sealing.openSecret(rowOf(sealed), { schoolId: SCHOOL, profileId: OTHER_PROFILE }),
    ).toThrow(StorageFailedError)
  })

  it('does not open for another school at the same profile id', () => {
    const sealing = sealingWith(master)
    const sealed = sealing.sealProfile({ secret: SECRET }, scope)

    expect(() =>
      sealing.openSecret(rowOf(sealed), { schoolId: OTHER_SCHOOL, profileId: PROFILE }),
    ).toThrow(StorageFailedError)
  })

  it('does not open with a ciphertext carried in from another row', () => {
    const sealing = sealingWith(master)
    const mine = sealing.sealProfile({ secret: SECRET }, scope)
    const theirs = sealing.sealProfile({ secret: SECRET }, scope)

    const tampered = { ...rowOf(mine), secretCiphertext: theirs.secret.ciphertext }

    expect(() => sealing.openSecret(tampered, scope)).toThrow(StorageFailedError)
  })

  it('does not open under a different master key', () => {
    const sealed = sealingWith(master).sealProfile({ secret: SECRET }, scope)

    expect(() => sealingWith(Buffer.alloc(32, 9)).openSecret(rowOf(sealed), scope)).toThrow(
      StorageFailedError,
    )
  })

  it('refuses a single flipped bit rather than returning what it can decrypt', () => {
    const sealing = sealingWith(master)
    const sealed = sealing.sealProfile({ secret: SECRET }, scope)
    const bent = Buffer.from(sealed.secret.ciphertext)
    bent[0] ^= 0x01

    expect(() => sealing.openSecret({ ...rowOf(sealed), secretCiphertext: bent }, scope)).toThrow(
      StorageFailedError,
    )
  })

  it('says the ciphertext is unreadable when the row carries none at all', () => {
    const sealing = sealingWith(master)
    const sealed = sealing.sealProfile({ secret: SECRET }, scope)

    expect(() => sealing.openSecret({ ...rowOf(sealed), secretCiphertext: null }, scope)).toThrow(
      StorageFailedError,
    )
  })

  it('never names the secret in what it throws', () => {
    const sealing = sealingWith(master)
    const sealed = sealing.sealProfile({ secret: SECRET }, scope)

    try {
      sealing.openSecret(rowOf(sealed), { schoolId: OTHER_SCHOOL, profileId: PROFILE })
      throw new Error('the secret opened where it should not have')
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(SECRET)
      expect(String((error as Error).stack)).not.toContain(SECRET)
    }
  })
})

describe('sealing without a master key', () => {
  const scope = { schoolId: SCHOOL, profileId: PROFILE }

  it('refuses to seal, naming the variable that is missing', () => {
    expect(() => sealingWith(null).sealProfile({ secret: SECRET }, scope)).toThrow(
      /VIDYA_MEDIA_MASTER_KEY/,
    )
  })

  it('refuses to open, rather than treating a missing key as a wrong one', () => {
    const sealed = sealingWith(Buffer.alloc(32, 3)).sealProfile({ secret: SECRET }, scope)

    expect(() => sealingWith(null).openSecret(rowOf(sealed), scope)).toThrow(StorageFailedError)
  })
})
