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
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  lessonVersionId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  sectionId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: string

  @ApiProperty({ enum: domain.HomeworkStatuses, example: 'pending' })
  status: domain.HomeworkStatus

  @ApiProperty({ example: 'My answer' })
  text: string

  @ApiPropertyOptional({ example: 5 })
  grade?: number

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  reviewedById?: string

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  submittedAt?: string

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  reviewedAt?: string

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  answeredSupersededVersion?: boolean
}

export class HomeworkSummary implements protocol.HomeworkSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  sectionId: string

  @ApiProperty({ enum: domain.HomeworkStatuses, example: 'pending' })
  status: domain.HomeworkStatus

  @ApiPropertyOptional({ example: 5 })
  grade?: number

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  submittedAt?: string
}

export class SubmitHomeworkRequest implements protocol.SubmitHomeworkRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  lessonVersionId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  sectionId: string

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
  enrollmentId?: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  groupId?: string

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
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  enrollmentId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  lessonVersionId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  blockId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: string

  @ApiProperty({ example: { type: 'quiz', answer: 1 } })
  state: protocol.LessonBlockState

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  updatedAt: string
}

export class SaveBlockStateRequest implements protocol.SaveBlockStateRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  lessonVersionId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  blockId: string

  @ApiProperty({ example: { type: 'quiz', answer: 1 } })
  @IsObject()
  state: protocol.LessonBlockState
}

export class SaveBlockStateResponse extends BlockStateDetails {}

export class GetBlockStatesQuery implements protocol.GetBlockStatesQuery {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  enrollmentId: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  lessonVersionId?: string
}

export class GetBlockStatesResponse implements protocol.GetBlockStatesResponse {
  @ApiProperty({ type: [BlockStateDetails] })
  items: BlockStateDetails[]
}
