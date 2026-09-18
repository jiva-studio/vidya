import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import { IsOptional, IsUUID } from 'class-validator'

import { IsRoleExist } from '../validations'

export class GetSchoolConfigResponse {
  @ApiProperty({ example: 'id' })
  defaultStudentRoleId: domain.RoleId

  @ApiProperty({ example: ['studentRoleIds'] })
  studentRoleIds: domain.RoleId[]
}

export class UpdateSchoolConfigsRequest {
  @ApiPropertyOptional({ example: 'id' })
  @IsOptional()
  @IsUUID()
  @IsRoleExist()
  defaultStudentRoleId?: domain.RoleId

  @ApiPropertyOptional({ example: ['studentRoleIds'] })
  @IsOptional()
  @IsUUID(4, { each: true })
  studentRoleIds?: domain.RoleId[]
}

export class UpdateSchoolConfigResponse {
  constructor(options?: { success: boolean }) {
    this.success = options?.success ?? false
  }

  @ApiProperty({ example: true })
  success: boolean
}
