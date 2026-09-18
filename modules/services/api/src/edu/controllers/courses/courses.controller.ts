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
import { CoursesService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

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
  constructor(
    private readonly courses: CoursesService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/courses/:id                            */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.courses.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
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

    return this.mapper.map(course, entities.Course, dto.GetCourseResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/courses                              */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.courses.find())
  async getMany(
    @Query() query: dto.GetCoursesQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetCoursesResponse> {
    if (!auth.permissions.has(['courses:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const courses = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findAll({ where: { schoolId: query.schoolId } })

    return {
      items: courses.map((c) => this.mapper.map(c, entities.Course, dto.CourseSummary)),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                              POST /edu/courses                             */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.courses.create())
  async createOne(
    @Body() request: dto.CreateCourseRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateCourseResponse> {
    // A course is created inside a school, so the permission is checked against
    // that school specifically — holding courses:create somewhere else is not
    // authority here.
    if (!auth.permissions.has(['courses:create'], { schoolId: request.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const created = await this.courses.create(
      this.mapper.map(request, dto.CreateCourseRequest, entities.Course),
    )

    return this.mapper.map(created, entities.Course, dto.CreateCourseResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                           PATCH /edu/courses/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.courses.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe()) id: string,
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
    return this.mapper.map(updated, entities.Course, dto.UpdateCourseResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                          DELETE /edu/courses/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.courses.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe()) id: string,
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
