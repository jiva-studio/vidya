import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsSchoolExist } from '@vidya/api/edu/validations'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator'

import { PagedQuery } from './paging.dto'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export class UserRoleSummary implements protocol.UserRoleSummary {
  @ApiProperty({ example: 'id' })
  id: domain.RoleId

  @ApiProperty({ example: 'Teacher' })
  name: string
}

export class UserSummary implements protocol.UserSummary {
  @ApiProperty({ example: 'id' })
  id: domain.UserId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiProperty({ type: [UserRoleSummary] })
  roles: UserRoleSummary[]
}

export class UserDetailsRole implements protocol.UserDetailsRole {
  @ApiProperty({ example: 'id' })
  id: domain.RoleId

  @ApiProperty({ example: 'name' })
  name?: string
}

export class UserDetails implements protocol.UserDetails {
  @ApiProperty({ example: 'id' })
  id: domain.UserId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiProperty({ example: 'test@example.com' })
  email: string

  @ApiProperty({ example: '+123456789' })
  phone?: string

  @ApiProperty()
  roles: UserDetailsRole[]
}

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export class GetUsersQuery extends PagedQuery implements protocol.GetUsersQuery {
  constructor(options?: { schoolId?: domain.SchoolId }) {
    super()
    this.schoolId = options?.schoolId
  }

  @ApiPropertyOptional({ example: 'id' })
  @IsUUID()
  @IsOptional()
  @IsSchoolExist()
  schoolId?: domain.SchoolId

  @ApiPropertyOptional({ example: 'ann' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string
}

export class GetUserResponse extends UserDetails implements protocol.GetUserResponse {}

export class GetUsersResponse implements protocol.GetUsersResponse {
  constructor(options: { items: Array<UserSummary>; total?: number }) {
    this.items = options.items ?? []
    this.total = options.total ?? this.items.length
  }

  @ApiProperty({ type: [UserSummary] })
  items: UserSummary[]

  @ApiProperty({ example: 137 })
  total: number
}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export class UpdateUserRequest implements protocol.UpdateUserRequest {
  constructor(options?: { name?: string; email?: string; phone?: string }) {
    this.name = options?.name
    this.email = options?.email
    this.phone = options?.phone
  }

  @ApiPropertyOptional({ example: 'User' })
  @IsString()
  @IsOptional()
  @Matches(/[^ ]+/, {
    message: 'name should not be empty',
  })
  @MaxLength(128)
  name?: string

  @ApiPropertyOptional({ example: 'test@example.com' })
  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ example: '+123456789' })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string
}

export class UpdateUserResponse extends UserDetails implements protocol.UpdateUserResponse {}
