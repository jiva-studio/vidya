import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { EnrollmentsService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { MediaRefusalFilter } from '@vidya/api/media/controllers'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

import {
  toStudentVersionDetails,
  toVersionDetails,
  toVersionSummary,
} from '../../mappers/education.mapper'

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
// Content naming a file the school does not have is refused by the save, and
// that refusal is the media context's to phrase.
@UseFilters(MediaRefusalFilter)
export class LessonVersionsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly versions: LessonVersionsService,
    private readonly enrollments: EnrollmentsService,
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
  /*              GET /edu/lessons/:lessonId/versions/published                 */
  /* -------------------------------------------------------------------------- */

  /**
   * The version students work against, content included.
   *
   * It is declared above the `:versionId` route because Express matches in
   * declaration order and `published` is not a uuid.
   *
   * It answers the only question a student has, in one request and with the
   * quiz keys withheld, rather than listing every version and fetching one of
   * them.
   */
  @Get(Routes().edu.lessons.versions.published(':lessonId'))
  @ApiOperation({
    summary: 'Get the published version of a lesson',
    operationId: 'LessonVersion::getPublished',
  })
  @ApiOkResponse({
    type: dto.GetPublishedLessonVersionResponse,
    description: 'Published lesson version, without quiz answer keys',
  })
  async getPublished(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: domain.LessonId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetPublishedLessonVersionResponse> {
    const lesson = await this.lessons.findOneBy({ id: lessonId })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`)
    }

    await this.assertMayReadPublished(lesson, auth)
    const published = await this.versions.latestPublished(lessonId)

    if (!published) {
      throw new NotFoundException(`Lesson ${lessonId} has no published version`)
    }

    return toStudentVersionDetails(published)
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
    if (!auth.permissions.has(['lessons:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
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
    if (!auth.permissions.has(['lessons:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
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
    // Publishing freezes what students work against, so it is its own permission.
    if (!auth.permissions.has(['lessons:publish'])) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.lessonOr404(lessonId, auth)
    const published = await this.versions.publish(lessonId, versionId)

    return toVersionSummary(published)
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Helpers                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * Staff reach published content through their permission; a student reaches
   * it by holding a place on the course. A student holds no `lessons:read`, so
   * this is the one version route that does not go through `lessonOr404`.
   */
  private async assertMayReadPublished(
    lesson: entities.Lesson,
    auth: UserAuthentication,
  ): Promise<void> {
    if (auth.permissions.has(['lessons:read'], { schoolId: lesson.schoolId })) return

    const enrollment = await this.enrollments.findOneBy({
      studentId: auth.userId,
      courseId: lesson.courseId,
      status: 'accepted',
    })

    if (!enrollment) {
      throw new ForbiddenException('Not enrolled on the course this lesson belongs to')
    }
  }
}
