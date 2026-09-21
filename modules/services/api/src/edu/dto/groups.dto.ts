import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class GroupDetails implements protocol.GroupDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.GroupId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: domain.CourseId

  @ApiProperty({ example: 'Morning group' })
  name: string

  @ApiPropertyOptional({ example: 'Meets at 7am' })
  description?: string
}

export class GroupSummary implements protocol.GroupSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.GroupId

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  courseId: domain.CourseId

  @ApiProperty({ example: 'Morning group' })
  name: string

  @ApiProperty({ enum: domain.GroupStatuses, example: 'pending' })
  status: domain.GroupStatus
}

export class CreateGroupRequest implements protocol.CreateGroupRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: domain.CourseId

  @ApiProperty({ example: 'Morning group' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ example: 'Meets at 7am' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string
}

export class CreateGroupResponse implements protocol.CreateGroupResponse {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: domain.GroupId
}

export class GetGroupsQuery implements protocol.GetGroupsQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  courseId?: domain.CourseId
}

export class GetGroupsResponse implements protocol.GetGroupsResponse {
  @ApiProperty({ type: [GroupSummary] })
  items: GroupSummary[]
}

export class GetGroupResponse extends GroupDetails {}

export class UpdateGroupRequest implements protocol.UpdateGroupRequest {
  @ApiPropertyOptional({ example: 'Morning group' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional({ example: 'Meets at 7am' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string
}

export class UpdateGroupResponse extends GroupDetails {}

export class DeleteGroupResponse implements protocol.DeleteGroupResponse {
  @ApiProperty({ example: true })
  success: boolean
}
