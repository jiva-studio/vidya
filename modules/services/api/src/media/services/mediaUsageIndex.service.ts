import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { LessonVersionId, MediaId, SchoolId } from '@vidya/domain'
import { Lesson, LessonVersion, Media, MediaUsage } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { DataSource, EntityManager, In } from 'typeorm'

import { MediaRefusedError } from '../mediaRefusal'

/** What one version turned out to use, as the save that wrote it knows it. */
export type VersionUsage = {
  lessonVersionId: LessonVersionId
  schoolId: SchoolId
  mediaIds: MediaId[]
}

/**
 * Which files lesson content points at, and which lessons that makes undeletable.
 *
 * The index is recounted from the content rather than incremented per edit: a
 * counter that a save can miss drifts silently, and nothing afterwards can say
 * whether a file is still shown. Recounting also refuses a file the school does
 * not have — the version and its usage are written in one transaction, so a
 * save that would dangle stores nothing at all.
 */
@Injectable()
export class MediaUsageIndexService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Makes the index name exactly the files the content names.
   *
   * `manager` is the transaction the version itself is written in, and passing
   * anything else puts the index outside the refusal that must undo it.
   */
  async recordVersionUsage(manager: EntityManager, usage: VersionUsage): Promise<void> {
    const mediaIds = [...new Set(usage.mediaIds)]
    await this.assertSchoolHolds(manager, usage.schoolId, mediaIds)

    const usages = manager.getRepository(MediaUsage)
    const recorded = await usages.find({ where: { lessonVersionId: usage.lessonVersionId } })

    const dropped = recorded.filter((row) => !mediaIds.includes(row.mediaId))
    if (dropped.length > 0) await usages.delete({ id: In(dropped.map((row) => row.id)) })

    const added = mediaIds.filter((id) => !recorded.some((row) => row.mediaId === id))
    if (added.length === 0) return

    await usages.insert(
      added.map((mediaId) => ({
        mediaId,
        lessonVersionId: usage.lessonVersionId,
        schoolId: usage.schoolId,
        createdAt: new Date(),
      })),
    )
  }

  /**
   * The lessons a file may not be deleted out from under, named so the refusal
   * is actionable. A lesson is named once however many of its versions hold the
   * file.
   */
  async lessonsUsing(mediaId: MediaId): Promise<protocol.MediaInUseResponse['lessons']> {
    const usages = await this.dataSource.getRepository(MediaUsage).find({ where: { mediaId } })
    if (usages.length === 0) return []

    const versions = await this.dataSource.getRepository(LessonVersion).find({
      where: { id: In(usages.map((row) => row.lessonVersionId)) },
      select: ['lessonId'],
    })

    const lessons = await this.dataSource
      .getRepository(Lesson)
      .find({ where: { id: In(versions.map((version) => version.lessonId)) } })

    return lessons.map((lesson) => ({ lessonId: lesson.id, title: lesson.title }))
  }

  /**
   * A file the school does not have is refused, and another school's file is
   * unknown in exactly the same way: a lesson may only point at its own library.
   *
   * A file whose bytes are still landing is refused apart from that, because
   * the two are acted on differently: an upload in flight is worth waiting for,
   * while a file that failed or was archived is never going to be shown and the
   * author has to name another one.
   */
  private async assertSchoolHolds(
    manager: EntityManager,
    schoolId: SchoolId,
    mediaIds: MediaId[],
  ): Promise<void> {
    if (mediaIds.length === 0) return

    const held = await manager
      .getRepository(Media)
      .find({ where: { schoolId, id: In(mediaIds) }, select: ['id', 'status'] })

    if (held.length !== mediaIds.length) throw new MediaRefusedError('unknown-media')

    const unready = held.filter((row) => row.status !== 'ready')
    if (unready.length === 0) return

    throw new MediaRefusedError(
      unready.every((row) => row.status === 'pending') ? 'not-ready' : 'unknown-media',
    )
  }
}
