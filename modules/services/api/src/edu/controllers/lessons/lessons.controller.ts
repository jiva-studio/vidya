import { Mapper } from '@automapper/core'
import { InjectMapper } from '@automapper/nestjs'
import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

const Crud = CrudDecorators({
  entityName: 'Lesson',
  getOneResponseDto: dto.GetLessonResponse,
  getManyResponseDto: dto.GetLessonsResponse,
  createOneResponseDto: dto.CreateLessonResponse,
  updateOneResponseDto: dto.UpdateLessonResponse,
  deleteOneResponseDto: dto.DeleteLessonResponse,
})

@Controller()
@ApiTags('🎓 Education :: Lessons')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly courses: CoursesService,
    private readonly versions: LessonVersionsService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/lessons/:id                            */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.lessons.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const lesson = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`)
    }

    return this.mapper.map(lesson, entities.Lesson, dto.GetLessonResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/lessons                              */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.lessons.find())
  async getMany(
    @Query() query: dto.GetLessonsQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetLessonsResponse> {
    if (!auth.permissions.has(['lessons:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const lessons = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findAll({ where: { courseId: query.courseId } })

    return {
      items: lessons.map((c) => this.mapper.map(c, entities.Lesson, dto.LessonSummary)),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                              POST /edu/lessons                             */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.lessons.create())
  async createOne(
    @Body() request: dto.CreateLessonRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateLessonResponse> {
    // A lesson belongs to a course, and the course carries the school.
    const course = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id: request.courseId } })

    if (!course) {
      throw new NotFoundException(`Course with id ${request.courseId} not found`)
    }

    if (!auth.permissions.has(['lessons:create'], { schoolId: course.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const created = await this.lessons.create({
      courseId: request.courseId,
      lessonNumber: request.lessonNumber,
      title: request.title,
      schoolId: course.schoolId,
    })

    // A lesson is useless without somewhere to write its content, so it starts
    // life with an empty draft rather than making the editor create one.
    await this.versions.create({
      lessonId: created.id,
      version: 1,
      status: 'draft',
      content: { sections: [] },
    })

    return this.mapper.map(created, entities.Lesson, dto.CreateLessonResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                           PATCH /edu/lessons/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.lessons.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: dto.UpdateLessonRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateLessonResponse> {
    if (!auth.permissions.has(['lessons:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const lesson = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`)
    }

    const updated = await this.lessons.updateOneBy({ id }, request)
    return this.mapper.map(updated, entities.Lesson, dto.UpdateLessonResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                          DELETE /edu/lessons/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.lessons.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.DeleteLessonResponse> {
    if (!auth.permissions.has(['lessons:delete'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const lesson = await this.lessons
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`)
    }

    await this.lessons.deleteOneBy({ id })
    return { success: true }
  }
}
