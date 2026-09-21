import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { MediaId, MediaKind, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { Media, StorageProfile } from '@vidya/entities'
import { DataSource, EntityManager, IsNull, LessThan } from 'typeorm'

/** A row written before its bytes exist; `sizeBytes` is what the client promised. */
export type PendingMediaDraft = {
  id: MediaId
  schoolId: SchoolId
  profileId: StorageProfileId
  kind: MediaKind
  storageKey: string
  name: string
  mimeType: string
  sizeBytes: number
  createdBy: UserId
}

/** What storage reported about the object, which is the only description trusted. */
export type ConfirmedObject = {
  sizeBytes: number
  mimeType: string
  sha256: string | null
}

/**
 * The `media` rows, and the one place `usedBytes` moves.
 *
 * Turning a row ready and charging the profile for its bytes happen in one
 * transaction: a count that can be updated without the row, or a row that can
 * turn ready without the count, drifts from the bucket within a day and there
 * is nothing afterwards that can say which of the two is right.
 */
@Injectable()
export class MediaRowsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createPending(draft: PendingMediaDraft): Promise<Media> {
    return this.rows().save({
      ...draft,
      status: 'pending',
      sizeBytes: String(draft.sizeBytes),
      sha256: null,
      externalId: null,
      width: null,
      height: null,
      durationMs: null,
      posterMediaId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  async findById(mediaId: MediaId): Promise<Media | null> {
    return this.rows().findOne({ where: { id: mediaId } })
  }

  async findReadyByDigest(schoolId: SchoolId, sha256: string): Promise<Media | null> {
    return this.rows().findOne({ where: { schoolId, sha256, status: 'ready' } })
  }

  async markReady(media: Media, confirmed: ConfirmedObject): Promise<Media> {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Media).update(
        { id: media.id },
        {
          status: 'ready',
          sizeBytes: String(confirmed.sizeBytes),
          mimeType: confirmed.mimeType,
          sha256: confirmed.sha256,
          updatedAt: new Date(),
        },
      )

      await this.chargeProfile(manager, media.profileId, confirmed.sizeBytes)

      return manager.getRepository(Media).findOneOrFail({ where: { id: media.id } })
    })
  }

  async markFailed(mediaId: MediaId): Promise<void> {
    await this.rows().update({ id: mediaId }, { status: 'failed', updatedAt: new Date() })
  }

  async deleteRow(mediaId: MediaId): Promise<void> {
    await this.rows().delete({ id: mediaId })
  }

  /**
   * Drops a row and gives its bytes back to the profile that holds them.
   *
   * `manager` is the caller's transaction, so the row and the count move
   * together. Only a ready row was ever charged — a pending one's size was a
   * reservation that disappears with the row, and releasing it again would take
   * the profile below what its bucket actually holds.
   */
  async deleteChargedRow(manager: EntityManager, media: Media): Promise<void> {
    await manager.getRepository(Media).delete({ id: media.id })

    if (media.status !== 'ready') return

    await manager
      .getRepository(StorageProfile)
      .decrement({ id: media.profileId }, 'usedBytes', Number(media.sizeBytes))
  }

  /** The pending rows whose uploader has had long enough and is not coming back. */
  async findAbandoned(before: Date): Promise<Media[]> {
    return this.rows().find({
      where: { status: 'pending', createdAt: LessThan(before) },
      order: { createdAt: 'ASC' },
    })
  }

  /** Every bucket still in use, so the sweep can reach the sessions inside them. */
  async findLiveProfiles(): Promise<StorageProfile[]> {
    return this.dataSource
      .getRepository(StorageProfile)
      .find({ where: { retiredAt: IsNull() }, order: { createdAt: 'ASC' } })
  }

  private async chargeProfile(
    manager: EntityManager,
    profileId: StorageProfileId,
    sizeBytes: number,
  ): Promise<void> {
    await manager.getRepository(StorageProfile).increment({ id: profileId }, 'usedBytes', sizeBytes)
  }

  private rows() {
    return this.dataSource.getRepository(Media)
  }
}
