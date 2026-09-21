import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { AuditLogEntry, AuditLogService } from '@vidya/api/shared/services'
import { MediaId, UserId } from '@vidya/domain'
import { Media } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { MediaRefusedError } from '../mediaRefusal'
import { MediaRowsService } from './mediaRows.service'
import { MediaUsageIndexService } from './mediaUsageIndex.service'
import { SchoolStorageService } from './schoolStorage.service'

/**
 * Taking a file out of a school's library.
 *
 * A file any lesson version still points at is refused and the lessons are
 * named, because "in use" that does not say where is not something an
 * administrator can act on.
 *
 * The row is archived before the object is removed, and dropped only once the
 * object is gone. A school stops being charged the moment the row is archived,
 * so no step of this leaves a school paying for bytes it cannot see, and a
 * deletion that dies halfway leaves the sweep something it can finish.
 */
@Injectable()
export class MediaDeletionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rows: MediaRowsService,
    private readonly usages: MediaUsageIndexService,
    private readonly storages: SchoolStorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findMedia(mediaId: MediaId): Promise<Media | null> {
    return this.rows.findById(mediaId)
  }

  async deleteMedia(media: Media, actorUserId: UserId): Promise<void> {
    const lessons = await this.usages.lessonsUsing(media.id)
    if (lessons.length > 0) throw new MediaRefusedError('in-use', { lessons })

    const opened = await this.storages.openProfileById(media.profileId)

    await this.dataSource.transaction(async (manager) => {
      await this.rows.archiveRow(media.id, manager)
      await this.auditLog.record(this.deletionEntry(media, actorUserId), manager)
    })

    await opened.storage.remove(media.storageKey)
    await this.rows.deleteRow(media.id)
  }

  /** Names the object as well as the file, so a deletion can be reconciled with a bucket. */
  private deletionEntry(media: Media, actorUserId: UserId): AuditLogEntry {
    return {
      action: 'media.deleted',
      actorUserId,
      schoolId: media.schoolId,
      subjectType: 'media',
      subjectId: media.id,
      payload: {
        name: media.name,
        kind: media.kind,
        sizeBytes: Number(media.sizeBytes),
        profileId: media.profileId,
        storageKey: media.storageKey,
      },
    }
  }
}
