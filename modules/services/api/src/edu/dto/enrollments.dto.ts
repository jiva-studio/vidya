import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsEnum, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator'

export class EnrollmentDetails implements protocol.EnrollmentDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  courseId: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  groupId?: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  studentId: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: string

  @ApiProperty({ enum: domain.EnrollmentStatuses, example: 'pending' })
  status: domain.EnrollmentStatus

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  decidedById?: string

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  decidedAt?: string

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  createdAt: string
}

export class EnrollmentSummary implements protocol.EnrollmentSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  courseId: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  groupId?: string

  @ApiProperty({ enum: domain.EnrollmentStatuses, example: 'pending' })
  status: domain.EnrollmentStatus

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  createdAt: string
}

export class CreateEnrollmentRequest implements protocol.CreateEnrollmentRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: string
}

export class CreateEnrollmentResponse implements protocol.CreateEnrollmentResponse {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string
}

export class GetEnrollmentsQuery implements protocol.GetEnrollmentsQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  courseId?: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  groupId?: string

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  studentId?: string

  @ApiPropertyOptional({ enum: domain.EnrollmentStatuses })
  @IsOptional()
  @IsEnum(domain.EnrollmentStatuses)
  status?: domain.EnrollmentStatus
}

export class GetEnrollmentsResponse implements protocol.GetEnrollmentsResponse {
  @ApiProperty({ type: [EnrollmentSummary] })
  items: EnrollmentSummary[]
}

export class GetEnrollmentResponse extends EnrollmentDetails {}

export class ModerateEnrollmentRequest implements protocol.ModerateEnrollmentRequest {
  @ApiProperty({ enum: ['accepted', 'declined'], example: 'accepted' })
  @IsIn(['accepted', 'declined'])
  status: Extract<domain.EnrollmentStatus, 'accepted' | 'declined'>

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  groupId?: string
}

export class ModerateEnrollmentResponse extends EnrollmentDetails {}

export class AssignEnrollmentGroupRequest implements protocol.AssignEnrollmentGroupRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  groupId: string | null
}

export class AssignEnrollmentGroupResponse extends EnrollmentDetails {}

export class DeleteEnrollmentResponse implements protocol.DeleteEnrollmentResponse {
  @ApiProperty({ example: true })
  success: boolean
}
