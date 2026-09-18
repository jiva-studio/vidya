import { Mapper } from '@automapper/core'
import { InjectMapper } from '@automapper/nestjs'
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

const Crud = CrudDecorators({
  entityName: 'LessonVersion',
  getOneResponseDto: dto.GetLessonVersionResponse,
  getManyResponseDto: dto.GetLessonVersionsResponse,
  createOneResponseDto: dto.LessonVersionSummary,
  updateOneResponseDto: dto.UpdateLessonVersionResponse,
  deleteOneResponseDto: dto.DeleteLessonResponse,
})

@Controller()
@ApiTags('🎓 Education :: Lesson Versions')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class LessonVersionsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly versions: LessonVersionsService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /**
   * Resolves the lesson the caller is allowed to see, so every route below is
   * scoped by the lesson's school rather than trusting the version id alone.
   */
  private async lessonOr404(lessonId: string, auth: UserAuthentication) {
    const lesson = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id: lessonId } })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`)
    }

    return lesson
  }

  private async versionOr404(lessonId: string, versionId: string) {
    const version = await this.versions.findOneBy({ id: versionId, lessonId })

    if (!version) {
      throw new NotFoundException(`Version ${versionId} of lesson ${lessonId} not found`)
    }

    return version
  }

  /* -------------------------------------------------------------------------- */
  /*                    GET /edu/lessons/:lessonId/versions                     */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.lessons.versions.all(':lessonId'))
  async getMany(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonVersionsResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const versions = await this.versions.findAll({ where: { lessonId } })

    return {
      items: versions.map((v) =>
        this.mapper.map(v, entities.LessonVersion, dto.LessonVersionSummary),
      ),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*               GET /edu/lessons/:lessonId/versions/:versionId               */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.lessons.versions.get(':lessonId', ':versionId'))
  async getOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonVersionResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const version = await this.versionOr404(lessonId, versionId)

    return this.mapper.map(version, entities.LessonVersion, dto.GetLessonVersionResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                    POST /edu/lessons/:lessonId/versions                    */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.lessons.versions.create(':lessonId'))
  async createOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.LessonVersionSummary> {
    if (!auth.permissions.has(['lessons:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const existing = await this.versions.findAll({ where: { lessonId } })

    // Only one draft at a time: a second one would make "the draft" ambiguous
    // for the editor and for publishing.
    if (existing.some((v) => v.status === 'draft')) {
      throw new ConflictException(`Lesson ${lessonId} already has an open draft`)
    }

    // A new draft starts from the latest published content rather than empty,
    // because a revision is nearly always an edit of what is live.
    const latestPublished = existing
      .filter((v) => v.status === 'published')
      .sort((a, b) => b.version - a.version)[0]

    const created = await this.versions.create({
      lessonId,
      version: Math.max(0, ...existing.map((v) => v.version)) + 1,
      status: 'draft',
      content: latestPublished?.content ?? { sections: [] },
    })

    return this.mapper.map(created, entities.LessonVersion, dto.LessonVersionSummary)
  }

  /* -------------------------------------------------------------------------- */
  /*              PATCH /edu/lessons/:lessonId/versions/:versionId              */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.lessons.versions.update(':lessonId', ':versionId'))
  async updateOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() request: dto.UpdateLessonVersionRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateLessonVersionResponse> {
    if (!auth.permissions.has(['lessons:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const version = await this.versionOr404(lessonId, versionId)

    // Published content is what submitted homework points at. Editing it would
    // silently change the question a student already answered.
    if (version.status === 'published') {
      throw new ConflictException(
        `Version ${versionId} is published and cannot be edited. Create a new draft instead.`,
      )
    }

    const updated = await this.versions.updateOneBy({ id: versionId }, { content: request.content })

    return this.mapper.map(updated, entities.LessonVersion, dto.UpdateLessonVersionResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*          POST /edu/lessons/:lessonId/versions/:versionId/publish           */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.lessons.versions.publish(':lessonId', ':versionId'))
  async publish(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.PublishLessonVersionResponse> {
    // Publishing freezes content that students then work against, so it is a
    // separate permission from ordinary editing.
    if (!auth.permissions.has(['lessons:publish'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const version = await this.versionOr404(lessonId, versionId)

    if (version.status === 'published') {
      throw new ConflictException(`Version ${versionId} is already published`)
    }

    const published = await this.versions.updateOneBy(
      { id: versionId },
      { status: 'published', publishedAt: new Date() },
    )

    return this.mapper.map(published, entities.LessonVersion, dto.PublishLessonVersionResponse)
  }
}
