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
import { CoursesService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toCourseDetails, toCourseSummaries, toCreatedId } from '../../mappers/education.mapper'

const Crud = CrudDecorators({
  entityName: 'Course',
  getOneResponseDto: dto.GetCourseResponse,
  getManyResponseDto: dto.GetCoursesResponse,
  createOneResponseDto: dto.CreateCourseResponse,
  updateOneResponseDto: dto.UpdateCourseResponse,
  deleteOneResponseDto: dto.DeleteCourseResponse,
})

@Controller()
@ApiTags('🎓 Education :: Courses')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/courses/:id                            */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.courses.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.CourseId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetCourseResponse> {
    if (!auth.permissions.has(['courses:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const course = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`)
    }

    return toCourseDetails(course)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/courses                              */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.courses.find())
  async getMany(
    @Query() filters: dto.GetCoursesQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetCoursesResponse> {
    if (!auth.permissions.has(['courses:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const [courses, total] = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findAndCount({
        where: { ...dto.matchingName(filters.query), schoolId: filters.schoolId },
        order: { name: 'ASC', id: 'ASC' },
        ...dto.pageOf(filters),
      })

    return { items: toCourseSummaries(courses), total }
  }

  /* -------------------------------------------------------------------------- */
  /*                              POST /edu/courses                             */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.courses.create())
  async createOne(
    @Body() request: dto.CreateCourseRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateCourseResponse> {
    // The permission is checked against this school; holding it elsewhere is not authority.
    if (!auth.permissions.has(['courses:create'], { schoolId: request.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const created = await this.courses.create({
      schoolId: request.schoolId,
      name: request.name,
      description: request.description,
      learningType: request.learningType,
    })

    return toCreatedId(created)
  }

  /* -------------------------------------------------------------------------- */
  /*                           PATCH /edu/courses/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.courses.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe()) id: domain.CourseId,
    @Body() request: dto.UpdateCourseRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateCourseResponse> {
    if (!auth.permissions.has(['courses:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const course = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`)
    }

    const updated = await this.courses.updateOneBy({ id }, request)
    return toCourseDetails(updated)
  }

  /* -------------------------------------------------------------------------- */
  /*                          DELETE /edu/courses/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.courses.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe()) id: domain.CourseId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.DeleteCourseResponse> {
    if (!auth.permissions.has(['courses:delete'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const course = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`)
    }

    await this.courses.deleteOneBy({ id })
    return { success: true }
  }
}
