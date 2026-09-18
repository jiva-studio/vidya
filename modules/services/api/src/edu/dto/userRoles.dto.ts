import { ApiProperty } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsArray, IsUUID } from 'class-validator'

import { IsRoleExist, IsUserExist } from '../validations'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export class UserRole implements protocol.UserRole {
  @ApiProperty({ example: 'id' })
  roleId: domain.RoleId
}

/* -------------------------------------------------------------------------- */
/*                                     Get                                    */
/* -------------------------------------------------------------------------- */

export class GetUserRolesListRequest implements protocol.GetUserRolesListRequest {
  @ApiProperty({ example: 'id' })
  @IsUserExist()
  @IsUUID()
  userId: domain.UserId
}

export class GetUserRolesListResponse implements protocol.GetUserRolesListResponse {
  constructor(userRoles: UserRole[]) {
    this.userRoles = userRoles
  }

  @ApiProperty({ example: [{ roleId: 'id' }] })
  @IsArray({ each: true })
  userRoles: UserRole[]
}

/* -------------------------------------------------------------------------- */
/*                                     Set                                    */
/* -------------------------------------------------------------------------- */

export class SetUserRolesQuery implements protocol.SetUserRolesQuery {
  @ApiProperty({ example: 'id' })
  @IsUserExist()
  @IsUUID()
  userId: domain.UserId
}

export class SetUserRolesRequest implements protocol.SetUserRolesRequest {
  @ApiProperty({ example: ['roleId'] })
  @IsRoleExist({ each: true })
  @IsUUID('4', { each: true })
  @IsArray()
  roleIds: domain.RoleId[]
}

export class SetUserRolesResponse implements protocol.SetUserRolesResponse {}
