import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import { Routes } from '@vidya/protocol'

import { SchoolExistsPipe } from '../../pipes'
import { SchoolConfigsService, SchoolsService } from '../../services'

const Crud = CrudDecorators({
  entityName: 'School Config',
  getManyResponseDto: dto.GetSchoolConfigResponse,
  updateOneResponseDto: dto.UpdateSchoolConfigResponse,
})

@Controller()
@ApiTags('🏫 Education :: Schools')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class SchoolConfigsController {
  constructor(
    private readonly schoolConfigs: SchoolConfigsService,
    private readonly schoolsService: SchoolsService,
  ) {}

  @Crud.GetMany(Routes().edu.schools.configs.getAll(':schoolId'))
  async getAll(
    @Param('schoolId', new ParseUUIDPipe(), SchoolExistsPipe) schoolId: string,
    @Authentication() auth: UserAuthentication,
  ) {
    // Check if user has permission to read`
    if (!auth.permissions.has(['schools:read'], { schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const school = await this.schoolsService.findOneBy({ id: schoolId })
    return school.config
  }

  @Crud.UpdateOne(Routes().edu.schools.configs.update(':schoolId'))
  async updateOne(
    @Param('schoolId', new ParseUUIDPipe(), SchoolExistsPipe) schoolId: string,
    @Body() request: dto.UpdateSchoolConfigsRequest,
    @Authentication() auth: UserAuthentication,
  ) {
    // Check if user has permission to update
    if (!auth.permissions.has(['schools:update'], { schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.schoolConfigs.update(schoolId, request)

    // Send response
    return new dto.UpdateSchoolConfigResponse({ success: true })
  }
}
