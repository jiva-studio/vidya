import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator'

/**
 * A pull, as it arrives.
 *
 * `cursors` is deliberately typed as a plain object here rather than as a
 * validated class: its keys are scope keys and its values are positions, and
 * class-validator has no vocabulary for "every value of this map". The keys and
 * the values are checked in {@link SyncPullService}, which can refuse them with
 * the machine-readable code the contract promises instead of the generic
 * message a decorator would produce.
 */
export class PullRequestDto implements protocol.PullRequest {
  @ApiProperty({ example: 'device-8f2a6c14' })
  @IsString()
  @IsNotEmpty()
  deviceId: string

  @ApiProperty({
    description: 'Read position per scope, keyed "<kind>:<id>". An absent scope starts at 0.',
    example: { 'course:2f9a1c58-6d21-4f0e-9a44-0b7c1e5d3a10': 1180 },
  })
  @IsObject()
  cursors: protocol.SyncCursors

  @ApiPropertyOptional({
    description: `Rows wanted; clamped to ${protocol.SYNC_MAX_PULL_LIMIT}.`,
    example: protocol.SYNC_DEFAULT_PULL_LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number
}

class SyncScopeRefDto implements domain.SyncScopeRef {
  @ApiProperty({ enum: domain.SyncScopeKinds, example: 'course' })
  kind: domain.SyncScopeKind

  @ApiProperty({ example: '2f9a1c58-6d21-4f0e-9a44-0b7c1e5d3a10' })
  id: string
}

class SyncChangeDto implements protocol.SyncChange {
  @ApiProperty({ example: 1181 })
  serverSeq: number

  @ApiProperty({ enum: domain.SyncCollections, example: 'homework' })
  collection: domain.SyncCollection

  @ApiProperty({ example: 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48' })
  docId: string

  @ApiProperty({ enum: domain.SyncOps, example: 'upsert' })
  op: domain.SyncOp

  @ApiProperty({ nullable: true, description: 'The wire projection, or null on a tombstone.' })
  data: domain.SyncPayload | null

  @ApiProperty({ example: '001789689602000:00000:server' })
  hlc: string

  @ApiProperty({ type: SyncScopeRefDto })
  scope: domain.SyncScopeRef

  @ApiProperty({ example: '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915' })
  schoolId: domain.SchoolId

  @ApiProperty({ example: '2026-09-18T00:00:02.000Z' })
  createdAt: domain.IsoDateTime
}

class SyncScopeGrantDto implements protocol.SyncScopeGrant {
  @ApiProperty({ type: SyncScopeRefDto })
  scope: domain.SyncScopeRef

  @ApiProperty({ example: 1190 })
  headSeq: number
}

export class PullResponseDto implements protocol.PullResponse {
  @ApiProperty({ type: [SyncChangeDto] })
  changes: SyncChangeDto[]

  @ApiProperty({ description: 'The position every scope this page advanced now stands at.' })
  cursors: protocol.SyncCursors

  @ApiProperty({ type: [SyncScopeGrantDto], description: "The caller's rights as they stand now." })
  scopes: SyncScopeGrantDto[]

  @ApiProperty({ description: 'Per-scope checksum, so a device can find which scope diverged.' })
  checksums: protocol.SyncChecksums

  @ApiProperty({ example: false })
  hasMore: boolean
}
