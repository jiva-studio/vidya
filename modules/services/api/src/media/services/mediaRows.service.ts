import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { MediaId, MediaKind, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { Media, StorageProfile } from '@vidya/entities'
import { DataSource, EntityManager, IsNull, LessThan } from 'typeorm'

import { MediaRefusedError } from '../mediaRefusal'

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

/** Postgres names a foreign-key violation by its code; the in-memory database only in words. */
const refusedByAForeignKey = (err: unknown): boolean => {
  const { code, message } = err as { code?: string; message?: string }

  return code === '23503' || /foreign key constraint/i.test(message ?? '')
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
   * Drops a row once its object is gone.
   *
   * A version that started showing the file is the database's answer, not
   * ours: the usage rows reference this one, so the refusal arrives as a
   * foreign-key violation and is answered as "in use" rather than as a fault.
   */
  async deleteRow(mediaId: MediaId, manager?: EntityManager): Promise<void> {
    try {
      await (manager ? manager.getRepository(Media) : this.rows()).delete({ id: mediaId })
    } catch (err) {
      if (!refusedByAForeignKey(err)) throw err

      throw new MediaRefusedError('in-use')
    }
  }

  /**
   * Archives a row, which is what stops the school being charged for its bytes.
   *
   * The check for lessons that still show the file is part of the statement
   * rather than a read before it: between a read and an update a lesson save
   * commits, and the deletion would go on to take the object out from under a
   * published lesson. A row nothing may archive is refused as in use.
   *
   * Pass `manager` to archive inside the caller's transaction, so what else
   * that transaction writes about the deletion cannot outlive the archiving.
   */
  async archiveRow(mediaId: MediaId, manager?: EntityManager): Promise<void> {
    const now = new Date()
    const archived = await (manager ?? this.dataSource)
      .createQueryBuilder()
      .update(Media)
      .set({ status: 'archived', archivedAt: now, updatedAt: now })
      .where('"id" = :mediaId', { mediaId })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM "media_usages" WHERE "media_usages"."mediaId" = :mediaId)',
      )
      .execute()

    if (archived.affected === 0) throw new MediaRefusedError('in-use')
  }

  /**
   * The rows a sweep has to clear: an upload whose bytes never came, and a
   * deletion that archived its row and never took the object out.
   *
   * An archived row is dated by when it was archived, so a deletion that is
   * still running is never swept out from under itself.
   */
  async findAbandoned(before: Date): Promise<Media[]> {
    return this.rows().find({
      where: [
        { status: 'pending', createdAt: LessThan(before) },
        { status: 'archived', archivedAt: LessThan(before) },
      ],
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
