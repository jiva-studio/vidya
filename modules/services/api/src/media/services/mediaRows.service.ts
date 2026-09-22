import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { MediaId, MediaKind, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { Media, StorageProfile } from '@vidya/entities'
import { DataSource, IsNull, LessThan, QueryFailedError } from 'typeorm'

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

/** The digest index a losing completion trips: another row already holds these bytes. */
const DIGEST_INDEX = 'UQ_media_school_sha256_ready'

/** True when a write lost the race for one ready row per digest, rather than failing. */
export const isDigestCollision = (failure: unknown): boolean => {
  const driver = (failure as QueryFailedError)?.driverError as
    { code?: string; constraint?: string } | undefined

  if (driver?.code !== '23505') return false

  return (driver.constraint ?? (failure as Error).message).includes(DIGEST_INDEX)
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

  /**
   * Keeps a reservation only if the school has room for it, and withdraws it
   * otherwise.
   *
   * Room is counted from the rows themselves and never from this process: more
   * than one instance signs uploads against one database, so occupancy read
   * before the row is written lets ten simultaneous asks each fit on their own
   * and overfill the bucket together. What a reservation is measured against is
   * therefore everything already charged plus every reservation written before
   * this one — an order the rows agree on whoever reads them — so a reservation
   * survives only when it fits behind those ahead of it. A row ahead that is
   * withdrawn afterwards leaves this one refused when it would have fitted,
   * which is the direction to be wrong in.
   */
  async keepIfRoom(media: Media, quotaBytes: number): Promise<boolean> {
    const reserved = await this.bytesUpTo(media)

    if (reserved <= quotaBytes) return true

    await this.deleteRow(media.id)

    return false
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

  async deleteRow(mediaId: MediaId): Promise<void> {
    await this.rows().delete({ id: mediaId })
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

  /** What the school is charged for, plus every reservation up to this one. */
  private async bytesUpTo(media: Media): Promise<number> {
    const summed = await this.rows()
      .createQueryBuilder('media')
      .select('COALESCE(SUM(media."sizeBytes"), 0)', 'bytes')
      .where('media."schoolId" = :schoolId', { schoolId: media.schoolId })
      .andWhere(
        `(media."status" = 'ready' OR (media."status" = 'pending' AND (media."createdAt" < :at OR ` +
          `(media."createdAt" = :at AND media."id" <= :id))))`,
        { at: media.createdAt, id: media.id },
      )
      .getRawOne<{ bytes: string | number }>()

    return Number(summed?.bytes ?? 0)
  }

  private rows() {
    return this.dataSource.getRepository(Media)
  }
}
