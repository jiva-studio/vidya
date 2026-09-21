import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

import { PagedQuery } from './paging.dto'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export class SchoolDetails implements protocol.SchoolDetails {
  @ApiProperty({ example: 'id' })
  id: domain.SchoolId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiPropertyOptional({ example: 'https://cdn.example.org/logo.png' })
  logoUrl: string | null

  @ApiPropertyOptional({ example: 'Scripture, kirtan and practice.' })
  description: string | null
}

export class SchoolSummary implements protocol.SchoolSummary {
  @ApiProperty({ example: 'id' })
  id: domain.SchoolId

  @ApiProperty({ example: 'name' })
  name: string

  @ApiPropertyOptional({ example: 'https://cdn.example.org/logo.png' })
  logoUrl: string | null
}

/* -------------------------------------------------------------------------- */
/*                                     Get                                    */
/* -------------------------------------------------------------------------- */

export class GetSchoolResponse extends SchoolDetails implements protocol.GetSchoolResponse {}

export class GetSchoolsQuery extends PagedQuery implements protocol.GetSchoolsQuery {
  @ApiPropertyOptional({ example: 'morning' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string
}

export class GetSchoolsResponse implements protocol.GetSchoolsResponse {
  constructor(options: { items: Array<SchoolSummary>; total?: number }) {
    this.items = options.items ?? []
    this.total = options.total ?? this.items.length
  }

  @ApiProperty({
    example: [
      {
        id: 'guid',
        name: 'High School',
      },
    ],
  })
  items: SchoolSummary[]

  @ApiProperty({ example: 137 })
  total: number
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export class CreateSchoolRequest implements protocol.CreateSchoolRequest {
  constructor(options?: { name?: string; logoUrl?: string; description?: string }) {
    this.name = options?.name
    this.logoUrl = options?.logoUrl ?? null
    this.description = options?.description ?? null
  }

  @ApiProperty({ example: 'name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(32)
  name: string

  @ApiPropertyOptional({ example: 'https://cdn.example.org/logo.png' })
  @IsUrl()
  @IsOptional()
  logoUrl: string | null

  @ApiPropertyOptional({ example: 'Scripture, kirtan and practice.' })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description: string | null
}

export class CreateSchoolResponse implements protocol.CreateSchoolResponse {
  @ApiProperty({ example: 'd66c9ffa-1d94-4d52-8399-0df211d578f6' })
  id: domain.SchoolId
}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export class UpdateSchoolRequest implements protocol.UpdateSchoolRequest {
  constructor(options?: { name?: string; logoUrl?: string; description?: string }) {
    this.name = options?.name
    this.logoUrl = options?.logoUrl
    this.description = options?.description
  }

  @ApiPropertyOptional({ example: 'name' })
  @IsString()
  @IsOptional()
  @Matches(/[^ ]+/, {
    message: 'name should not be empty',
  })
  @MaxLength(32)
  name?: string

  @ApiPropertyOptional({ example: 'https://cdn.example.org/logo.png' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string | null

  @ApiPropertyOptional({ example: 'Scripture, kirtan and practice.' })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string | null
}

export class UpdateSchoolResponse extends SchoolDetails implements protocol.UpdateSchoolResponse {}

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export class DeleteSchoolResponse implements protocol.DeleteSchoolResponse {
  constructor(options?: { success: boolean }) {
    this.success = options?.success ?? true
  }
  @ApiProperty({ example: true })
  success: boolean
}
