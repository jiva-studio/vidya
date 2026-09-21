import {
  Body,
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
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toVersionDetails, toVersionSummary } from '../../mappers/education.mapper'

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
  ) {}

  /**
   * Resolves the lesson the caller is allowed to see, so every route below is
   * scoped by the lesson's school rather than trusting the version id alone.
   */
  private async lessonOr404(lessonId: domain.LessonId, auth: UserAuthentication) {
    const lesson = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id: lessonId } })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`)
    }

    return lesson
  }

  /* -------------------------------------------------------------------------- */
  /*                    GET /edu/lessons/:lessonId/versions                     */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.lessons.versions.all(':lessonId'))
  async getMany(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonVersionsResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const versions = await this.versions.findAll({ where: { lessonId } })

    return {
      items: versions.map((v) => toVersionSummary(v)),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*               GET /edu/lessons/:lessonId/versions/:versionId               */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.lessons.versions.get(':lessonId', ':versionId'))
  async getOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Param('versionId', new ParseUUIDPipe()) versionId: domain.LessonVersionId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonVersionResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const version = await this.versions.getOrFail(lessonId, versionId)

    return toVersionDetails(version)
  }

  /* -------------------------------------------------------------------------- */
  /*                    POST /edu/lessons/:lessonId/versions                    */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.lessons.versions.create(':lessonId'))
  async createOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.LessonVersionSummary> {
    const lesson = await this.lessonOr404(lessonId, auth)

    if (!auth.permissions.has(['lessons:update'], { schoolId: lesson.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const created = await this.versions.openDraft(lessonId)

    return toVersionSummary(created)
  }

  /* -------------------------------------------------------------------------- */
  /*              PATCH /edu/lessons/:lessonId/versions/:versionId              */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.lessons.versions.update(':lessonId', ':versionId'))
  async updateOne(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Param('versionId', new ParseUUIDPipe()) versionId: domain.LessonVersionId,
    @Body() request: dto.UpdateLessonVersionRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateLessonVersionResponse> {
    const lesson = await this.lessonOr404(lessonId, auth)

    if (!auth.permissions.has(['lessons:update'], { schoolId: lesson.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const updated = await this.versions.saveDraft(lessonId, versionId, request.content)

    return toVersionDetails(updated)
  }

  /* -------------------------------------------------------------------------- */
  /*          POST /edu/lessons/:lessonId/versions/:versionId/publish           */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.lessons.versions.publish(':lessonId', ':versionId'))
  async publish(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Param('versionId', new ParseUUIDPipe()) versionId: domain.LessonVersionId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.PublishLessonVersionResponse> {
    const lesson = await this.lessonOr404(lessonId, auth)

    // Publishing freezes what students work against, so it is its own permission.
    if (!auth.permissions.has(['lessons:publish'], { schoolId: lesson.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const published = await this.versions.publish(lessonId, versionId)

    return toVersionSummary(published)
  }
}
