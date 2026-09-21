import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { SchoolExistsPipe } from '@vidya/api/edu/pipes'
import { SchoolCreationService, SchoolsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toId, toSchoolDetails, toSchoolSummaries } from '../../mappers/org.mapper'

const Crud = CrudDecorators({
  entityName: 'School',
  getOneResponseDto: dto.GetSchoolResponse,
  getManyResponseDto: dto.GetSchoolsResponse,
  createOneResponseDto: dto.CreateSchoolResponse,
  updateOneResponseDto: dto.UpdateSchoolResponse,
  deleteOneResponseDto: dto.DeleteSchoolResponse,
})

@Controller()
@ApiTags('🏫 Education :: Schools')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly schoolCreationService: SchoolCreationService,
  ) {}
  /* -------------------------------------------------------------------------- */
  /*                             GET /edu/schools/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.schools.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetSchoolResponse> {
    // Check if user has permission to read schools
    if (!auth.permissions.has(['schools:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get school by Id with user permissions scope
    const school = await this.schoolsService
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    // No school found with the given Id
    if (!school) {
      throw new NotFoundException(`School with id ${id} not found`)
    }

    // Return school response
    return toSchoolDetails(school)
  }

  /* -------------------------------------------------------------------------- */
  /*                               GET /edu/schools                             */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.schools.find())
  async getMany(@Authentication() auth: UserAuthentication): Promise<dto.GetSchoolsResponse> {
    // Check if user has permission to read schools
    if (!auth.permissions.has(['schools:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get schools with user permissions scope
    const schools = await this.schoolsService
      .scopedBy({ permissions: auth.permissions })
      .findAll({})

    // Return schools response
    return new dto.GetSchoolsResponse({
      items: toSchoolSummaries(schools),
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                               POST /edu/schools                            */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.schools.create())
  async createOne(
    @Body() request: dto.CreateSchoolRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateSchoolResponse> {
    // Check if user has permission to create schools
    if (!auth.permissions.has(['schools:create'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Create new school
    const entity = await this.schoolCreationService.createNewSchool(auth.userId, {
      name: request.name,
      logoUrl: request.logoUrl ?? null,
      description: request.description ?? null,
    })

    // Return created school response
    return toId(entity)
  }

  /* -------------------------------------------------------------------------- */
  /*                            PATCH /edu/schools/:id                          */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.schools.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe(), SchoolExistsPipe) id: domain.SchoolId,
    @Body() request: dto.UpdateSchoolRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateSchoolResponse> {
    // Check if user has permission to update school
    if (!auth.permissions.has(['schools:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get school by Id with user permissions scope
    let school = await this.schoolsService
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    // No school found with the given Id
    if (!school) {
      throw new NotFoundException(`School with id ${id} not found`)
    }

    // Update school
    school = await this.schoolsService.updateOneBy(
      { id },
      { name: request.name, logoUrl: request.logoUrl, description: request.description },
    )

    // Return updated school response
    return toSchoolDetails(school)
  }

  /* -------------------------------------------------------------------------- */
  /*                        POST /edu/schools/:id/code                          */
  /* -------------------------------------------------------------------------- */

  /**
   * Mints the school's joining code, or returns the one it already holds.
   *
   * Asked for rather than handed out at creation: until a school wants a link,
   * no link to it exists anywhere, and that is the only state in which nobody
   * can be holding one. Minting twice is the same as minting once.
   */
  @Post(Routes().edu.schools.code(':id'))
  @ApiOperation({ summary: "Mint the school's joining code", operationId: 'School::mintCode' })
  @ApiOkResponse({ type: dto.MintSchoolCodeResponse, description: 'The code, new or existing' })
  async mintCode(
    @Param('id', new ParseUUIDPipe(), SchoolExistsPipe) id: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.MintSchoolCodeResponse> {
    if (!auth.permissions.has(['schools:update'], { schoolId: id })) {
      throw new ForbiddenException('User does not have permission')
    }

    const school = await this.schoolsService.getOrFail(id)

    return { code: await this.schoolsService.mintCode(school) }
  }

  /* -------------------------------------------------------------------------- */
  /*                            DELETE /edu/schools/:id                         */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.schools.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe(), SchoolExistsPipe) id: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.DeleteSchoolResponse> {
    // Check if user has permission to delete school
    if (!auth.permissions.has(['schools:delete'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get school by Id with user permissions scope
    const school = await this.schoolsService
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    // No school found with the given Id
    if (!school) {
      throw new NotFoundException(`School with id ${id} not found`)
    }

    // Delete school
    await this.schoolsService.deleteOneBy({ id })

    // Return success response
    return new dto.DeleteSchoolResponse({ success: true })
  }
}
