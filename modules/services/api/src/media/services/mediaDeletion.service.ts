import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { AuditLogService } from '@vidya/api/shared/services'
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
 * The object goes before the row: an object left without its row is found by
 * nothing and is paid for forever, while a row left without its object is a
 * broken thumbnail the next delete clears up.
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
    await opened.storage.remove(media.storageKey)

    await this.dataSource.transaction(async (manager) => {
      await this.rows.deleteChargedRow(manager, media)

      await this.auditLog.record(
        {
          action: 'media.deleted',
          actorUserId,
          schoolId: media.schoolId,
          subjectType: 'media',
          subjectId: media.id,
          payload: { name: media.name, kind: media.kind, sizeBytes: Number(media.sizeBytes) },
        },
        manager,
      )
    })
  }
}
