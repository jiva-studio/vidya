import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as protocol from '@vidya/protocol'
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class GroupDetails implements protocol.GroupDetails {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string

  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: string

  @ApiProperty({ example: 'Morning group' })
  name: string

  @ApiPropertyOptional({ example: 'Meets at 7am' })
  description?: string
}

export class GroupSummary implements protocol.GroupSummary {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  id: string

  @ApiProperty({ example: 'Morning group' })
  name: string
}

export class CreateGroupRequest implements protocol.CreateGroupRequest {
  @ApiProperty({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsUUID()
  courseId: string

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
  id: string
}

export class GetGroupsQuery implements protocol.GetGroupsQuery {
  @ApiPropertyOptional({ example: '6eb216f2-543d-4f15-88f5-f325a1bdcafd' })
  @IsOptional()
  @IsUUID()
  courseId?: string
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
