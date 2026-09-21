import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { SchoolId, StorageProfileId } from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'

const ALGORITHM = 'aes-256-gcm'
const NONCE_BYTES = 12
const TAG_BYTES = 16

export type SealedValue = { ciphertext: Buffer; nonce: Buffer }

export type SealedProfile = {
  keyVersion: number
  dek: SealedValue
  secret: SealedValue
  tokenSecret: SealedValue | null
}

/** What a ciphertext is bound to, and therefore what it stops opening outside of. */
export type SealingScope = { schoolId: SchoolId; profileId: StorageProfileId }

export type SealedRow = {
  keyVersion: number
  dekCiphertext: Buffer | null
  dekNonce: Buffer | null
  secretCiphertext: Buffer | null
  secretNonce: Buffer | null
}

const seal = (key: Buffer, plaintext: Buffer, aad: Buffer): SealedValue => {
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  cipher.setAAD(aad)

  const body = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { ciphertext: Buffer.concat([body, cipher.getAuthTag()]), nonce }
}

const open = (key: Buffer, sealed: SealedValue, aad: Buffer): Buffer => {
  const body = sealed.ciphertext.subarray(0, sealed.ciphertext.length - TAG_BYTES)
  const tag = sealed.ciphertext.subarray(sealed.ciphertext.length - TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, sealed.nonce)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(body), decipher.final()])
}

/**
 * Seals a school's storage credentials, and opens them again.
 *
 * Two layers, because they are rotated on different schedules: each profile
 * gets its own data key, and only that key is wrapped under the installation's
 * master key. Rotating the master key then rewraps a handful of small keys
 * instead of decrypting and re-encrypting every secret, and `keyVersion` lets
 * the old and the new master key be in use at the same time while it happens.
 *
 * The school and the profile go into the additional data, so a ciphertext is
 * only readable in the row it was written for. A dump restored into the wrong
 * row, or a migration that copied a column, fails to open rather than quietly
 * handing one school's credentials to another.
 */
@Injectable()
export class SecretSealingService {
  constructor(@Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>) {}

  sealProfile(
    secrets: { secret: string; tokenSecret?: string },
    scope: SealingScope,
  ): SealedProfile {
    const master = this.masterKey()
    const dek = randomBytes(32)
    const aad = additionalData(scope)

    return {
      keyVersion: this.config.keyVersion,
      dek: seal(master, dek, aad),
      secret: seal(dek, Buffer.from(secrets.secret, 'utf8'), aad),
      tokenSecret: secrets.tokenSecret
        ? seal(dek, Buffer.from(secrets.tokenSecret, 'utf8'), aad)
        : null,
    }
  }

  openSecret(row: SealedRow, scope: SealingScope): string {
    const aad = additionalData(scope)

    try {
      const dek = open(this.masterKey(), asSealed(row.dekCiphertext, row.dekNonce), aad)
      return open(dek, asSealed(row.secretCiphertext, row.secretNonce), aad).toString('utf8')
    } catch {
      // Why it will not open is not something the school can act on, and the
      // detail would be about the ciphertext of their credentials.
      throw new StorageFailedError('secret-unreadable')
    }
  }

  private masterKey(): Buffer {
    const key = this.config.masterKey

    if (!key) {
      throw new Error(
        'VIDYA_MEDIA_MASTER_KEY is not set; stored storage credentials cannot be read or written.',
      )
    }

    return key
  }
}

const additionalData = (scope: SealingScope): Buffer =>
  Buffer.from(`storage-profile:${scope.schoolId}:${scope.profileId}`, 'utf8')

const asSealed = (ciphertext: Buffer | null, nonce: Buffer | null): SealedValue => {
  if (!ciphertext || !nonce) throw new Error('The row carries no sealed value.')

  return { ciphertext, nonce }
}
