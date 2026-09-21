import { ApiProperty } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import { IsArray, IsBoolean, IsString, IsUUID } from 'class-validator'

import { IsSchoolExist } from '../validations'

/* -------------------------------------------------------------------------- */
/*                                     Get                                    */
/* -------------------------------------------------------------------------- */

export class GetUserSchoolsListResponse {
  constructor(userSchools: string[]) {
    this.userSchools = userSchools
  }

  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsString({ each: true })
  userSchools: string[]
}

/* -------------------------------------------------------------------------- */
/*                                     Set                                    */
/* -------------------------------------------------------------------------- */

export class AddUserSchoolsRequest {
  @ApiProperty({ example: 'id' })
  @IsSchoolExist()
  @IsUUID('4')
  schoolId: domain.SchoolId
}

export class AddUserSchoolsResponse {
  constructor(options?: { success: boolean }) {
    this.success = options?.success ?? false
  }

  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean
}

/* -------------------------------------------------------------------------- */
/*                                   Leave                                    */
/* -------------------------------------------------------------------------- */

export class LeaveSchoolResponse {
  constructor(options?: { revokedPlaces: number }) {
    this.revokedPlaces = options?.revokedPlaces ?? 0
  }

  /**
   * How many places the departure took with it.
   *
   * Leaving a school is leaving its courses: the role is what grants them, and
   * taking the role back revokes every live place it carried. The caller is
   * told the number so the screen can say it before asking for a confirmation.
   */
  @ApiProperty({ example: 2 })
  revokedPlaces: number
}
