import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { SealedText, StorageSecrets } from '@vidya/entities'

import { StorageFailedError } from '../storageFailure'

const ALGORITHM = 'aes-256-gcm'
const NONCE_BYTES = 12
const TAG_BYTES = 16
const DEK_BYTES = 32

/**
 * What a ciphertext is bound to, and therefore what it stops opening outside of.
 *
 * The school is null for the installation's own bucket, which belongs to none.
 */
export type SealingScope = { schoolId: SchoolId | null; profileId: StorageProfileId }

/** The credentials a school hands over; the token secret only when it has a CDN. */
export type StoragePlainSecrets = { secret: string; tokenSecret?: string }

const seal = (key: Buffer, plaintext: Buffer, aad: Buffer): SealedText => {
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  cipher.setAAD(aad)

  const body = Buffer.concat([cipher.update(plaintext), cipher.final()])

  return {
    ciphertext: Buffer.concat([body, cipher.getAuthTag()]).toString('base64'),
    nonce: nonce.toString('base64'),
  }
}

const open = (key: Buffer, sealed: SealedText, aad: Buffer): Buffer => {
  const whole = Buffer.from(sealed.ciphertext, 'base64')
  const body = whole.subarray(0, whole.length - TAG_BYTES)
  const tag = whole.subarray(whole.length - TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.nonce, 'base64'))
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(body), decipher.final()])
}

/**
 * Seals a school's storage credentials, and opens them again.
 *
 * Two layers, because they are rotated on different schedules: each profile
 * gets its own data key, and only that key is wrapped under the installation's
 * master key. A document records the master key version it was wrapped under
 * and is opened under that key, which is what lets a new master key be
 * installed beside the old one without the profiles sealed earlier becoming
 * unreadable.
 *
 * Nothing here re-seals a document under a newer key, so the old key stays in
 * the keyring for as long as any profile names it: a rotation is possible, not
 * operated, until something exists to rewrap what the old key still holds.
 *
 * The school and the profile go into the additional data, so a ciphertext is
 * only readable in the row it was written for. A dump restored into the wrong
 * row, or a migration that copied a column, fails to open rather than quietly
 * handing one school's credentials to another.
 */
@Injectable()
export class SecretSealingService {
  constructor(@Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>) {}

  sealProfile(secrets: StoragePlainSecrets, scope: SealingScope): StorageSecrets {
    const master = this.currentKey()
    const dek = randomBytes(DEK_BYTES)
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

  openSecret(secrets: StorageSecrets, scope: SealingScope): string {
    const aad = additionalData(scope)

    try {
      const dek = open(this.keyThatWrapped(secrets), required(secrets?.dek), aad)

      return open(dek, required(secrets.secret), aad).toString('utf8')
    } catch {
      // Why it will not open is not something the school can act on, and the
      // detail would be about the ciphertext of their credentials.
      throw new StorageFailedError('secret-unreadable')
    }
  }

  /**
   * The key the document names, and never the current one instead.
   *
   * Falling back to whichever key is current would make a document sealed under
   * a retired key look like a wrong secret, and would make the version it
   * records decorative — the point at which a rotation quietly stops being
   * possible.
   */
  private keyThatWrapped(secrets: StorageSecrets): Buffer {
    const key = this.keyring()[secrets?.keyVersion]
    if (!key) throw new StorageFailedError('secret-unreadable')

    return key
  }

  private currentKey(): Buffer {
    const key = this.keyring()[this.config.keyVersion]

    if (!key) {
      throw new Error(
        'VIDYA_MEDIA_MASTER_KEY is not set; stored storage credentials cannot be read or written.',
      )
    }

    return key
  }

  /** The key in use, named by `keyVersion`, beside every key still held for older documents. */
  private keyring(): Record<number, Buffer> {
    const { masterKey, keyVersion, masterKeys } = this.config

    return { ...(masterKey ? { [keyVersion]: masterKey } : {}), ...masterKeys }
  }
}

const additionalData = (scope: SealingScope): Buffer =>
  Buffer.from(`storage-profile:${scope.schoolId}:${scope.profileId}`, 'utf8')

const required = (sealed: SealedText | null | undefined): SealedText => {
  if (!sealed?.ciphertext || !sealed.nonce) throw new Error('The row carries no sealed value.')

  return sealed
}
