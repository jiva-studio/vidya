import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

import { IsPermissionsProhibited } from '../validations'
import { PagedQuery } from './paging.dto'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export class RoleDetails implements protocol.RoleDetails {
  @ApiProperty({ example: 'id' })
  id: domain.RoleId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiProperty({ example: 'description' })
  description: string

  @ApiProperty({ example: ['permissions'] })
  permissions: domain.PermissionKey[]

  @ApiProperty({ example: 'schoolId' })
  @IsUUID()
  schoolId: domain.SchoolId
}

export class RoleSummary implements protocol.RoleSummary {
  @ApiProperty({ example: 'id' })
  id: domain.RoleId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiProperty({ example: 'description' })
  description: string
}

/* -------------------------------------------------------------------------- */
/*                                     Get                                    */
/* -------------------------------------------------------------------------- */

export class GetRoleResponse extends RoleDetails implements protocol.GetRoleResponse {}

export class GetRoleSummariesListQuery
  extends PagedQuery
  implements protocol.GetRoleSummariesListQuery
{
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  schoolId?: domain.SchoolId

  @ApiPropertyOptional({ example: 'teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string
}

export class GetRolesResponse implements protocol.GetRolesResponse {
  constructor(options: { items: Array<RoleSummary>; total?: number }) {
    this.items = options.items ?? []
    this.total = options.total ?? this.items.length
  }

  @ApiProperty({
    example: [
      {
        id: '1',
        name: 'Admin',
        description: 'Administrator role',
      },
    ],
  })
  items: RoleSummary[]

  @ApiProperty({ example: 137 })
  total: number
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export class CreateRoleRequest implements protocol.CreateRoleRequest {
  @ApiProperty({ example: 'name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(32)
  name: string

  @ApiProperty({ example: 'description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  description: string

  @ApiProperty({ example: ['permissions'] })
  @IsString({ each: true })
  @IsEnum(domain.PermissionEnum, { each: true })
  @IsPermissionsProhibited(['*'])
  permissions: domain.PermissionKey[]

  @ApiProperty({ example: 'schoolId' })
  @IsUUID()
  schoolId: domain.SchoolId
}

export class CreateRoleResponse implements protocol.CreateRoleResponse {
  @ApiProperty({ example: 'd66c9ffa-1d94-4d52-8399-0df211d578f6' })
  id: domain.RoleId
}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export class UpdateRoleRequest implements protocol.UpdateRoleRequest {
  @ApiPropertyOptional({ example: 'name' })
  @IsString()
  @IsOptional()
  @Matches(/[^ ]+/, {
    message: 'name should not be empty',
  })
  @MaxLength(32)
  name?: string

  @ApiPropertyOptional({ example: 'description' })
  @IsString()
  @IsOptional()
  @Matches(/[^ ]+/, {
    message: 'description should not be empty',
  })
  @MaxLength(256)
  description?: string

  @ApiPropertyOptional({ example: ['permissions'] })
  @IsString({ each: true })
  @IsEnum(domain.PermissionEnum, { each: true })
  @IsOptional()
  @IsPermissionsProhibited(['*'])
  permissions?: domain.PermissionKey[]
}

export class UpdateRoleResponse extends RoleDetails implements protocol.UpdateRoleResponse {}

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export class DeleteRoleResponse implements protocol.DeleteRoleResponse {
  constructor(options?: { success: boolean }) {
    this.success = options?.success ?? true
  }
  @ApiProperty({ example: true })
  success: boolean
}
