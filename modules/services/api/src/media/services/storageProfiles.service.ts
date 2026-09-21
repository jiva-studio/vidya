import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import {
  SchoolId,
  StorageDelivery,
  StorageProfileId,
  StorageProfileKind,
  VideoProvider,
} from '@vidya/domain'
import { School, StorageProfile } from '@vidya/entities'
import { DataSource, EntityManager, IsNull } from 'typeorm'

import { SealedProfile } from './secretSealing.service'

/** A profile as it is about to be written; a row is never edited after this. */
export type StorageProfileDraft = {
  id: StorageProfileId
  schoolId: SchoolId
  kind: StorageProfileKind
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  delivery: StorageDelivery
  publicBaseUrl: string | null
  video: VideoProvider
  quotaBytes: number | null
  sealed: SealedProfile
  verifiedAt: Date | null
}

/**
 * The rows behind a school's storage.
 *
 * Writing new credentials retires the old row and inserts a new one in one
 * transaction: the school must never be left pointing at nothing, and two live
 * profiles would leave it ambiguous which one a new upload belongs in. The
 * retired row stays exactly as it was, because the files it wrote are still
 * read through the keys it holds.
 */
@Injectable()
export class StorageProfilesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findCurrentFor(schoolId: SchoolId): Promise<StorageProfile | null> {
    return this.dataSource
      .getRepository(StorageProfile)
      .findOne({ where: { schoolId, retiredAt: IsNull() } })
  }

  async findById(profileId: StorageProfileId): Promise<StorageProfile | null> {
    return this.dataSource.getRepository(StorageProfile).findOne({ where: { id: profileId } })
  }

  async replaceProfile(draft: StorageProfileDraft): Promise<StorageProfile> {
    return this.dataSource.transaction(async (manager) => {
      await this.retireLive(manager, draft.schoolId)

      const saved = await manager.getRepository(StorageProfile).save(rowFrom(draft))
      await manager
        .getRepository(School)
        .update({ id: draft.schoolId }, { currentStorageProfileId: saved.id })

      return saved
    })
  }

  /**
   * Writes a profile unless the school already has a live one.
   *
   * Which of two callers wins is the unique index's decision and not a read's:
   * both insert, the conflicting insert writes nothing, and who the live
   * profile belongs to is asked afterwards rather than before. Nothing is
   * inferred from the driver's answer to the insert, because a row carrying
   * its own id is reported as written whether it landed or not.
   */
  async insertIfAbsent(draft: StorageProfileDraft): Promise<StorageProfile | null> {
    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(StorageProfile)
        .createQueryBuilder()
        .insert()
        .values(rowFrom(draft))
        .orIgnore()
        .execute()

      const live = await manager
        .getRepository(StorageProfile)
        .findOne({ where: { schoolId: draft.schoolId, retiredAt: IsNull() } })

      if (live?.id !== draft.id) return null

      await manager
        .getRepository(School)
        .update({ id: draft.schoolId }, { currentStorageProfileId: draft.id })

      return live
    })
  }

  async retireProfile(schoolId: SchoolId): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.retireLive(manager, schoolId)
      await manager
        .getRepository(School)
        .update({ id: schoolId }, { currentStorageProfileId: null })
    })
  }

  async recordVerification(
    profileId: StorageProfileId,
    verifiedAt: Date | null,
    verifyError: string | null,
  ): Promise<void> {
    await this.dataSource
      .getRepository(StorageProfile)
      .update({ id: profileId }, { verifiedAt, verifyError, updatedAt: new Date() })
  }

  private async retireLive(manager: EntityManager, schoolId: SchoolId): Promise<void> {
    await manager
      .getRepository(StorageProfile)
      .update({ schoolId, retiredAt: IsNull() }, { retiredAt: new Date(), updatedAt: new Date() })
  }
}

const rowFrom = (draft: StorageProfileDraft): Partial<StorageProfile> => ({
  id: draft.id,
  schoolId: draft.schoolId,
  kind: draft.kind,
  endpoint: draft.endpoint,
  region: draft.region,
  bucket: draft.bucket,
  prefix: draft.prefix,
  accessKeyId: draft.accessKeyId,
  secretCiphertext: draft.sealed.secret.ciphertext,
  secretNonce: draft.sealed.secret.nonce,
  keyVersion: draft.sealed.keyVersion,
  dekCiphertext: draft.sealed.dek.ciphertext,
  dekNonce: draft.sealed.dek.nonce,
  delivery: draft.delivery,
  publicBaseUrl: draft.publicBaseUrl,
  tokenSecretCiphertext: draft.sealed.tokenSecret?.ciphertext ?? null,
  tokenSecretNonce: draft.sealed.tokenSecret?.nonce ?? null,
  video: draft.video,
  quotaBytes: draft.quotaBytes === null ? null : String(draft.quotaBytes),
  usedBytes: '0',
  verifiedAt: draft.verifiedAt,
  verifyError: null,
  retiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})
