import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessonVersion } from '@vidya/entities'
import { LessonContent } from '@vidya/protocol'
import { Repository } from 'typeorm'

import { EntitiesService } from './entities.service'

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
 */
@Injectable()
export class LessonVersionsService extends EntitiesService<LessonVersion> {
  constructor(@InjectRepository(LessonVersion) repository: Repository<LessonVersion>) {
    super(repository)
  }

  async getOrFail(lessonId: string, versionId: string): Promise<LessonVersion> {
    const version = await this.findOneBy({ id: versionId, lessonId })

    if (!version) {
      throw new NotFoundException(`Version ${versionId} of lesson ${lessonId} not found`)
    }

    return version
  }

  /** The version students are working against right now, if the lesson has one. */
  async latestPublished(lessonId: string): Promise<LessonVersion | undefined> {
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
  async createInitialDraft(lessonId: string): Promise<LessonVersion> {
    return this.create({ lessonId, version: 1, status: 'draft', content: { sections: [] } })
  }

  /**
   * Opens a revision.
   *
   * It starts from the published content rather than empty, because a revision
   * is nearly always an edit of what is live. Only one draft may be open at a
   * time; a second would make "the draft" ambiguous for both the editor and
   * publishing.
   */
  async openDraft(lessonId: string): Promise<LessonVersion> {
    const existing = await this.findAll({ where: { lessonId } })

    if (existing.some((v) => v.status === 'draft')) {
      throw new ConflictException(`Lesson ${lessonId} already has an open draft`)
    }

    const latestPublished = existing
      .filter((v) => v.status === 'published')
      .sort((a, b) => b.version - a.version)[0]

    return this.create({
      lessonId,
      version: Math.max(0, ...existing.map((v) => v.version)) + 1,
      status: 'draft',
      content: (latestPublished?.content as LessonContent) ?? { sections: [] },
    })
  }

  /** Published content is what submitted homework points at, so only drafts change. */
  async saveDraft(
    lessonId: string,
    versionId: string,
    content: LessonContent,
  ): Promise<LessonVersion> {
    const version = await this.getOrFail(lessonId, versionId)

    if (version.status === 'published') {
      throw new ConflictException(
        `Version ${versionId} is published and cannot be edited. Create a new draft instead.`,
      )
    }

    return this.updateOneBy({ id: versionId }, { content })
  }

  /** Freezes the version. From here it is a stable target for homework. */
  async publish(lessonId: string, versionId: string): Promise<LessonVersion> {
    const version = await this.getOrFail(lessonId, versionId)

    if (version.status === 'published') {
      throw new ConflictException(`Version ${versionId} is already published`)
    }

    return this.updateOneBy({ id: versionId }, { status: 'published', publishedAt: new Date() })
  }
}
