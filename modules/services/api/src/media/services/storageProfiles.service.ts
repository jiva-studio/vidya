import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { SchoolId, StorageDelivery, StorageProfileId, StorageProvider } from '@vidya/domain'
import { School, StorageProfile, StorageSecrets } from '@vidya/entities'
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm'

import { StorageFailedError } from '../storageFailure'

const UNIQUE_VIOLATION = '23505'
const LIVE_PER_SCHOOL = 'UQ_storage_profiles_live_per_school'

/** Whether the write lost a race for the school's one live profile. */
const isLiveProfileTaken = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) return false

  const driver = error.driverError as { code?: string; constraint?: string } | undefined

  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === LIVE_PER_SCHOOL
}

/** A profile as it is about to be written; a row is never edited after this. */
export type StorageProfileDraft = {
  id: StorageProfileId
  schoolId: SchoolId
  provider: StorageProvider

  /** Null for every provider whose address we compose ourselves. */
  endpoint: string | null

  region: string

  /** The account R2 is addressed by, and null for every other provider. */
  r2AccountId: string | null
  bucket: string
  prefix: string
  accessKeyId: string
  delivery: StorageDelivery
  publicBaseUrl: string | null
  secrets: StorageSecrets

  /** Null while nobody has probed these keys, which is how a lent row starts. */
  verifiedAt: Date | null
}

/** The installation's own bucket, which belongs to no school and names none. */
export type InstallationProfileDraft = Omit<StorageProfileDraft, 'schoolId'>

/**
 * The rows behind a school's storage.
 *
 * Writing new credentials retires the old row and inserts a new one in one
 * transaction: the school must never be left pointing at nothing, and two live
 * profiles would leave it ambiguous which one a new upload belongs in. The
 * retired row stays exactly as it was, because the files it wrote are still
 * read through the keys it holds.
 *
 * The installation's own bucket is a row here too, naming no school: a file is
 * read through the profile that wrote it, so the bucket a school is lent has to
 * be something a file can point at for as long as it exists.
 */
@Injectable()
export class StorageProfilesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findCurrentFor(schoolId: SchoolId): Promise<StorageProfile | null> {
    return this.dataSource
      .getRepository(StorageProfile)
      .findOne({ where: { schoolId, retiredAt: IsNull() } })
  }

  /**
   * Retires the live row and writes a new one, or refuses because somebody else
   * did it first: the database holds the school to one live profile, and the
   * writer that lost has to read what is live now rather than be told a
   * constraint name.
   */
  async replaceProfile(draft: StorageProfileDraft): Promise<StorageProfile> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.retireLive(manager, draft.schoolId)

        const saved = await manager
          .getRepository(StorageProfile)
          .save(rowFrom(draft, draft.schoolId))
        await manager
          .getRepository(School)
          .update({ id: draft.schoolId }, { currentStorageProfileId: saved.id })

        return saved
      })
    } catch (error) {
      if (isLiveProfileTaken(error)) throw new StorageFailedError('rotation-conflicted')

      throw error
    }
  }

  /** The installation's own bucket, which has no school and one live row. */
  async findInstallationProfile(): Promise<StorageProfile | null> {
    return this.dataSource
      .getRepository(StorageProfile)
      .findOne({ where: { schoolId: IsNull(), retiredAt: IsNull() } })
  }

  /**
   * Writes the installation's row, or reads the one another request wrote.
   *
   * Two schools touching the lent bucket for the first time at once both try to
   * create it; the partial unique index keeps one, and the loser wants that row
   * rather than a refusal — neither school asked for a profile to be created.
   */
  async createInstallationProfile(draft: InstallationProfileDraft): Promise<StorageProfile> {
    try {
      return await this.dataSource.getRepository(StorageProfile).save(rowFrom(draft, null))
    } catch (error) {
      const written = await this.findInstallationProfile()
      if (!written) throw error

      return written
    }
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

const rowFrom = (
  draft: InstallationProfileDraft,
  schoolId: SchoolId | null,
): Partial<StorageProfile> => ({
  id: draft.id,
  schoolId,
  provider: draft.provider,
  endpoint: draft.endpoint,
  region: draft.region,
  r2AccountId: draft.r2AccountId,
  bucket: draft.bucket,
  prefix: draft.prefix,
  accessKeyId: draft.accessKeyId,
  secrets: draft.secrets,
  delivery: draft.delivery,
  publicBaseUrl: draft.publicBaseUrl,
  verifiedAt: draft.verifiedAt,
  verifyError: null,
  retiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})
