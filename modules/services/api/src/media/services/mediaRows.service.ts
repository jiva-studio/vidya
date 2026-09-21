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
 * The `media` rows: written before their bytes, and the record of what a school
 * is charged for.
 *
 * Nothing counts the bytes on the side. What a school occupies is summed from
 * the rows that are ready, so a row turning ready is the whole of the change —
 * a counter kept elsewhere drifts from the rows within a day, and nothing
 * afterwards can say which of the two is right.
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
    await this.rows().update(
      { id: media.id },
      {
        status: 'ready',
        sizeBytes: String(confirmed.sizeBytes),
        mimeType: confirmed.mimeType,
        sha256: confirmed.sha256,
        updatedAt: new Date(),
      },
    )

    return this.rows().findOneOrFail({ where: { id: media.id } })
  }

  async markFailed(mediaId: MediaId): Promise<void> {
    await this.rows().update({ id: mediaId }, { status: 'failed', updatedAt: new Date() })
  }

  /**
   * Drops a row, and with it the bytes it was charged for.
   *
   * Pass `manager` to drop the row inside the caller's transaction, so what
   * else that transaction writes about the deletion cannot outlive the row.
   * Nothing else has to be released: the sum a school is charged for is read
   * off the rows, so the row leaving is the whole of the change.
   */
  async deleteRow(mediaId: MediaId, manager?: EntityManager): Promise<void> {
    await (manager ? manager.getRepository(Media) : this.rows()).delete({ id: mediaId })
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

  private rows() {
    return this.dataSource.getRepository(Media)
  }
}
