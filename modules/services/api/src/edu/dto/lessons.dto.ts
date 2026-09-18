import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

export class LessonDetails implements protocol.LessonDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.LessonId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: domain.CourseId

  @ApiProperty({ example: 1 })
  lessonNumber: number

  @ApiProperty({ example: 'Introduction' })
  title: string
}

export class LessonSummary implements protocol.LessonSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.LessonId

  @ApiProperty({ example: 1 })
  lessonNumber: number

  @ApiProperty({ example: 'Introduction' })
  title: string
}

export class CreateLessonRequest implements protocol.CreateLessonRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: domain.CourseId

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  lessonNumber: number

  @ApiProperty({ example: 'Introduction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string
}

export class CreateLessonResponse implements protocol.CreateLessonResponse {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.LessonId
}

export class GetLessonsQuery implements protocol.GetLessonsQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  courseId?: domain.CourseId
}

export class GetLessonsResponse implements protocol.GetLessonsResponse {
  @ApiProperty({ type: [LessonSummary] })
  items: LessonSummary[]
}

export class GetLessonResponse extends LessonDetails {}

export class UpdateLessonRequest implements protocol.UpdateLessonRequest {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  lessonNumber?: number

  @ApiPropertyOptional({ example: 'Introduction' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string
}

export class UpdateLessonResponse extends LessonDetails {}

export class DeleteLessonResponse implements protocol.DeleteLessonResponse {
  @ApiProperty({ example: true })
  success: boolean
}

/* -------------------------------------------------------------------------- */
/*                                  Versions                                  */
/* -------------------------------------------------------------------------- */

export class LessonVersionSummary implements protocol.LessonVersionSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.LessonVersionId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  lessonId: domain.LessonId

  @ApiProperty({ example: 1 })
  version: number

  @ApiProperty({ enum: domain.LessonVersionStatuses, example: 'draft' })
  status: domain.LessonVersionStatus

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  publishedAt?: domain.IsoDateTime
}

export class LessonVersionDetails extends LessonVersionSummary {
  @ApiProperty({ example: { sections: [] } })
  content: protocol.LessonContent
}

export class GetLessonVersionsResponse implements protocol.GetLessonVersionsResponse {
  @ApiProperty({ type: [LessonVersionSummary] })
  items: LessonVersionSummary[]
}

export class GetLessonVersionResponse extends LessonVersionDetails {}

export class UpdateLessonVersionRequest implements protocol.UpdateLessonVersionRequest {
  @ApiProperty({ example: { sections: [] } })
  @IsObject()
  content: protocol.LessonContent
}

export class UpdateLessonVersionResponse extends LessonVersionDetails {}

export class PublishLessonVersionResponse extends LessonVersionSummary {}
