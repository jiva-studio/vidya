import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsEnum, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator'

export class EnrollmentDetails implements protocol.EnrollmentDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.EnrollmentId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  courseId: domain.CourseId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  groupId?: domain.GroupId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  studentId: domain.UserId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  schoolId: domain.SchoolId

  @ApiProperty({ enum: domain.EnrollmentStatuses, example: 'pending' })
  status: domain.EnrollmentStatus

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  decidedById?: domain.UserId

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  decidedAt?: domain.IsoDateTime

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  createdAt: domain.IsoDateTime

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  preferredGroupId?: domain.GroupId

  @ApiPropertyOptional({
    example: {
      timeZone: 'Asia/Kolkata',
      ranges: [{ days: ['sat', 'sun'], startMinute: 420, endMinute: 660 }],
    },
  })
  preferredTimes?: domain.PreferredTimes

  @ApiPropertyOptional({ example: 'Evenings are hard, I work late.' })
  comment?: string

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  archivedByStudentAt?: domain.IsoDateTime

  @ApiPropertyOptional({ example: '2026-09-18T10:00:00.000Z' })
  archivedBySchoolAt?: domain.IsoDateTime

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  archivedBySchoolById?: domain.UserId
}

export class EnrollmentSummary implements protocol.EnrollmentSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.EnrollmentId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  courseId: domain.CourseId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  groupId?: domain.GroupId

  @ApiProperty({ enum: domain.EnrollmentStatuses, example: 'pending' })
  status: domain.EnrollmentStatus

  @ApiProperty({ example: '2026-09-18T10:00:00.000Z' })
  createdAt: domain.IsoDateTime
}

export class GetEnrollmentsQuery implements protocol.GetEnrollmentsQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  courseId?: domain.CourseId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  groupId?: domain.GroupId

  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  studentId?: domain.UserId

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
  groupId?: domain.GroupId
}

export class ModerateEnrollmentResponse extends EnrollmentDetails {}

export class ArchiveEnrollmentResponse extends EnrollmentDetails {}

export class AssignEnrollmentGroupRequest implements protocol.AssignEnrollmentGroupRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  groupId: domain.GroupId | null
}

export class AssignEnrollmentGroupResponse extends EnrollmentDetails {}

export class DeleteEnrollmentResponse implements protocol.DeleteEnrollmentResponse {
  @ApiProperty({ example: true })
  success: boolean
}
