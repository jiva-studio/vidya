import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class HomeworkDetails implements protocol.HomeworkDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.HomeworkId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: domain.EnrollmentId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  lessonVersionId: domain.LessonVersionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  sectionId: domain.SectionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: domain.SchoolId

  @ApiProperty({ enum: domain.HomeworkStatuses, example: 'pending' })
  status: domain.HomeworkStatus

  @ApiProperty({ example: 'My answer' })
  text: string

  @ApiPropertyOptional({ example: 5 })
  grade?: number

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  reviewedById?: domain.UserId

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  submittedAt?: domain.IsoDateTime

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  reviewedAt?: domain.IsoDateTime

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  answeredSupersededVersion?: boolean

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  createdAt: domain.IsoDateTime
}

export class HomeworkSummary implements protocol.HomeworkSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.HomeworkId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: domain.EnrollmentId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  sectionId: domain.SectionId

  @ApiProperty({ enum: domain.HomeworkStatuses, example: 'pending' })
  status: domain.HomeworkStatus

  @ApiPropertyOptional({ example: 5 })
  grade?: number

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  submittedAt?: domain.IsoDateTime
}

export class SubmitHomeworkRequest implements protocol.SubmitHomeworkRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  lessonVersionId: domain.LessonVersionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  sectionId: domain.SectionId

  @ApiProperty({ example: 'My answer' })
  @IsString()
  @MaxLength(65535)
  text: string
}

export class SubmitHomeworkResponse extends HomeworkDetails {}

export class GetHomeworkQuery implements protocol.GetHomeworkQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  enrollmentId?: domain.EnrollmentId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  groupId?: domain.GroupId

  @ApiPropertyOptional({ enum: domain.HomeworkStatuses })
  @IsOptional()
  @IsIn(domain.HomeworkStatuses)
  status?: domain.HomeworkStatus
}

export class GetHomeworkListResponse implements protocol.GetHomeworkListResponse {
  @ApiProperty({ type: [HomeworkSummary] })
  items: HomeworkSummary[]
}

export class GetHomeworkResponse extends HomeworkDetails {}

export class ReviewHomeworkRequest implements protocol.ReviewHomeworkRequest {
  @ApiProperty({ enum: ['in_review', 'returned', 'accepted'], example: 'accepted' })
  @IsIn(['in_review', 'returned', 'accepted'])
  status: Extract<domain.HomeworkStatus, 'in_review' | 'returned' | 'accepted'>

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  grade?: number

  @ApiPropertyOptional({ example: 'Well done' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  comment?: string
}

export class ReviewHomeworkResponse extends HomeworkDetails {}

/* -------------------------------------------------------------------------- */
/*                                  Progress                                  */
/* -------------------------------------------------------------------------- */

export class BlockStateDetails implements protocol.BlockStateDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.BlockStateId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: domain.EnrollmentId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  lessonVersionId: domain.LessonVersionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  blockId: domain.BlockId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: domain.SchoolId

  @ApiProperty({ example: { type: 'quiz', answer: 1 } })
  state: protocol.LessonBlockState

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  updatedAt: domain.IsoDateTime
}

export class SaveBlockStateRequest implements protocol.SaveBlockStateRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  lessonVersionId: domain.LessonVersionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  blockId: domain.BlockId

  @ApiProperty({ example: { type: 'quiz', answer: 1 } })
  @IsObject()
  state: protocol.LessonBlockState
}

export class SaveBlockStateResponse extends BlockStateDetails {}

export class GetBlockStatesQuery implements protocol.GetBlockStatesQuery {
  // Omitted means "mine": a student holds several enrolments and, on a first
  // run, knows none of their ids yet.
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  enrollmentId?: domain.EnrollmentId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  lessonVersionId?: domain.LessonVersionId
}

export class GetBlockStatesResponse implements protocol.GetBlockStatesResponse {
  @ApiProperty({ type: [BlockStateDetails] })
  items: BlockStateDetails[]
}
