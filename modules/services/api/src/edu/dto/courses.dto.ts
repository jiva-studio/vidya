import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

import { PagedQuery } from './paging.dto'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export class CourseDetails implements protocol.CourseDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.CourseId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  schoolId: domain.SchoolId

  @ApiProperty({ example: 'Bhakti-shastri' })
  name: string

  @ApiPropertyOptional({ example: 'A one year course' })
  description?: string

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  coverImageUrl?: string | null

  @ApiProperty({ enum: domain.CourseLearningTypes, example: 'group' })
  learningType: domain.CourseLearningType

  @ApiProperty({ enum: domain.CourseStatuses, example: 'published' })
  status: domain.CourseStatus
}

export class CourseSummary implements protocol.CourseSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.CourseId

  @ApiProperty({ enum: domain.CourseStatuses, example: 'published' })
  status: domain.CourseStatus

  @ApiProperty({ example: 'Bhakti-shastri' })
  name: string

  @ApiPropertyOptional({ example: 'A one year course' })
  description?: string

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  coverImageUrl?: string | null
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export class CreateCourseRequest implements protocol.CreateCourseRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  schoolId: domain.SchoolId

  @ApiProperty({ example: 'Bhakti-shastri' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ example: 'A one year course' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null

  @ApiProperty({ enum: domain.CourseLearningTypes, example: 'group' })
  @IsEnum(domain.CourseLearningTypes)
  learningType: domain.CourseLearningType
}

export class CreateCourseResponse implements protocol.CreateCourseResponse {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.CourseId
}

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export class GetCoursesQuery extends PagedQuery implements protocol.GetCoursesQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  schoolId?: domain.SchoolId

  @ApiPropertyOptional({ example: 'morning' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string
}

export class GetCoursesResponse implements protocol.GetCoursesResponse {
  @ApiProperty({ type: [CourseSummary] })
  items: CourseSummary[]

  @ApiProperty({ example: 137 })
  total: number
}

export class GetCourseResponse extends CourseDetails {}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export class UpdateCourseRequest implements protocol.UpdateCourseRequest {
  @ApiPropertyOptional({ enum: domain.CourseStatuses, example: 'published' })
  @IsOptional()
  @IsEnum(domain.CourseStatuses)
  status?: domain.CourseStatus

  @ApiPropertyOptional({ example: 'Bhakti-shastri' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ example: 'A one year course' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string | null

  @ApiPropertyOptional({ enum: domain.CourseLearningTypes, example: 'group' })
  @IsOptional()
  @IsEnum(domain.CourseLearningTypes)
  learningType?: domain.CourseLearningType
}

export class UpdateCourseResponse extends CourseDetails {}

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export class DeleteCourseResponse implements protocol.DeleteCourseResponse {
  @ApiProperty({ example: true })
  success: boolean
}
