import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { MediaUsageIndexService } from '@vidya/api/media/services'
import * as domain from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'
import { Lesson, LessonVersion } from '@vidya/entities'
import { LessonContent } from '@vidya/protocol'
import { EntityManager, Repository } from 'typeorm'

import { EntitiesService } from './entities.service'
import { mediaIdsIn } from './mediaInContent'

/**
 * The lifecycle of a lesson's content.
 *
 * The rules live here rather than in the controller because HTTP is not the
 * only way in: the offline sync endpoints will reach the same transitions, and
 * a rule that only exists in a controller is a rule the second caller does not
 * get.
 *
 * Versions are reached through their lesson, which is what carries the school,
 * so this service does not scope by itself — the caller proves access to the
 * lesson first.
 *
 * Every write of content also recounts the files it uses, in the write's own
 * transaction: the index is what refuses the deletion of a file a lesson shows,
 * so a save that stored content without its usage — or refused a file after
 * storing the content — would leave the two disagreeing with nothing able to
 * say which is right.
 */
@Injectable()
export class LessonVersionsService extends EntitiesService<LessonVersion> {
  constructor(
    @InjectRepository(LessonVersion) repository: Repository<LessonVersion>,
    private readonly usages: MediaUsageIndexService,
  ) {
    super(repository)
  }

  async getOrFail(
    lessonId: domain.LessonId,
    versionId: domain.LessonVersionId,
  ): Promise<LessonVersion> {
    const version = await this.findOneBy({ id: versionId, lessonId })

    if (!version) {
      throw new NotFoundException(`Version ${versionId} of lesson ${lessonId} not found`)
    }

    return version
  }

  /** The version students are working against right now, if the lesson has one. */
  async latestPublished(lessonId: domain.LessonId): Promise<LessonVersion | undefined> {
    const published = await this.findAll({ where: { lessonId, status: 'published' } })

    return published.sort((a, b) => b.version - a.version)[0]
  }

  /**
   * Whether this version had already been superseded when it was answered.
   *
   * Used to flag homework rather than reject it: a revision published while a
   * device was offline is not the student's fault, but the reviewer needs to
   * know which text the answer was written against.
   */
  async isSuperseded(version: LessonVersion): Promise<boolean> {
    const latest = await this.latestPublished(version.lessonId)

    return Boolean(latest) && latest.id !== version.id
  }

  /** Every lesson starts with somewhere to write, so the editor never has to create one. */
  async createInitialDraft(lessonId: domain.LessonId): Promise<LessonVersion> {
    return this.create({ lessonId, version: 1, status: 'draft', content: emptyLessonContent() })
  }

  /**
   * Opens a revision.
   *
   * It starts from the published content rather than empty, because a revision
   * is nearly always an edit of what is live. Only one draft may be open at a
   * time; a second would make "the draft" ambiguous for both the editor and
   * publishing.
   */
  async openDraft(lessonId: domain.LessonId): Promise<LessonVersion> {
    const existing = await this.findAll({ where: { lessonId } })

    if (existing.some((v) => v.status === 'draft')) {
      throw new ConflictException(`Lesson ${lessonId} already has an open draft`)
    }

    const latestPublished = existing
      .filter((v) => v.status === 'published')
      .sort((a, b) => b.version - a.version)[0]

    const content = (latestPublished?.content as LessonContent) ?? emptyLessonContent()
    const version = Math.max(0, ...existing.map((v) => v.version)) + 1

    return this.writeNewVersion(
      this.repository.create({ lessonId, version, status: 'draft', content }),
      content,
    )
  }

  /** Published content is what submitted homework points at, so only drafts change. */
  async saveDraft(
    lessonId: domain.LessonId,
    versionId: domain.LessonVersionId,
    content: LessonContent,
  ): Promise<LessonVersion> {
    const version = await this.getOrFail(lessonId, versionId)

    if (version.status === 'published') {
      throw new ConflictException(
        `Version ${versionId} is published and cannot be edited. Create a new draft instead.`,
      )
    }

    return this.rewriteContent(version, content)
  }

  /** Stores new content and the files it names together, or neither. */
  private async rewriteContent(
    version: LessonVersion,
    content: LessonContent,
  ): Promise<LessonVersion> {
    return this.repository.manager.transaction(async (manager) => {
      await this.recordUsage(manager, version, content)

      return manager.getRepository(LessonVersion).save(this.repository.merge(version, { content }))
    })
  }

  /** A version has to be stored before a usage row is allowed to name it. */
  private async writeNewVersion(
    version: LessonVersion,
    content: LessonContent,
  ): Promise<LessonVersion> {
    return this.repository.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(LessonVersion).save(version)
      await this.recordUsage(manager, saved, content)

      return saved
    })
  }

  private async recordUsage(
    manager: EntityManager,
    version: LessonVersion,
    content: LessonContent,
  ): Promise<void> {
    const lesson = await manager.getRepository(Lesson).findOneByOrFail({ id: version.lessonId })

    await this.usages.recordVersionUsage(manager, {
      lessonVersionId: version.id,
      schoolId: lesson.schoolId,
      mediaIds: mediaIdsIn(content),
    })
  }

  /** Freezes the version. From here it is a stable target for homework. */
  async publish(
    lessonId: domain.LessonId,
    versionId: domain.LessonVersionId,
  ): Promise<LessonVersion> {
    const version = await this.getOrFail(lessonId, versionId)

    if (version.status === 'published') {
      throw new ConflictException(`Version ${versionId} is already published`)
    }

    return this.updateOneBy({ id: versionId }, { status: 'published', publishedAt: new Date() })
  }
}
