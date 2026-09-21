import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

/**
 * One pushed row, validated only as far as the envelope.
 *
 * The body is deliberately not validated here. A row whose payload does not fit
 * its collection is refused with `malformed` *and its neighbours are applied*;
 * a decorator on this class would instead fail the whole request with a 400 and
 * take six good rows down with the seventh. The per-collection check therefore
 * runs inside the push, where a refusal is a value rather than an exception.
 */
export class PushChangeDto implements protocol.PushChange {
  @ApiProperty({ example: 41, description: "The row's id in the device's outbox." })
  @IsInt()
  @Min(0)
  outboxId: number

  @ApiProperty({ enum: domain.SyncCollections, example: 'homework' })
  @IsString()
  collection: domain.SyncCollection

  @ApiProperty({ example: 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48' })
  @IsString()
  docId: string

  @ApiProperty({ enum: domain.SyncOps, example: 'upsert' })
  @IsString()
  op: domain.SyncOp

  @ApiPropertyOptional({ nullable: true, description: 'The fields the client owns.' })
  @IsOptional()
  data: domain.SyncPayload | null

  @ApiProperty({ example: '001789686000000:00000:device-8f2a6c14' })
  @IsString()
  hlc: string

  @ApiPropertyOptional({
    nullable: true,
    description: 'The last server HLC this change derived from; null when the doc is new here.',
  })
  @IsOptional()
  @IsString()
  baseHlc: string | null
}

export class PushRequestDto implements protocol.PushRequest {
  @ApiProperty({ example: 'device-8f2a6c14' })
  @IsString()
  @IsNotEmpty()
  deviceId: string

  @ApiProperty({ type: [PushChangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushChangeDto)
  changes: PushChangeDto[]
}

class PushResultDto {
  @ApiProperty({ example: 41 })
  outboxId: number

  @ApiProperty({ enum: domain.SyncCollections, example: 'homework' })
  collection: domain.SyncCollection

  @ApiProperty({ example: 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48' })
  docId: string

  @ApiProperty({ enum: ['accepted', 'rejected'], example: 'accepted' })
  status: 'accepted' | 'rejected'

  @ApiPropertyOptional({
    example: '001789686000000:00000:device-8f2a6c14',
    description: 'On an accepted row, the HLC the journal holds for it. Always present.',
  })
  serverHlc?: string

  @ApiPropertyOptional({ example: false, description: 'The server assigned a new stamp.' })
  restamped?: boolean

  @ApiPropertyOptional({ enum: domain.ServerRejectionReasons, example: 'readOnlyCollection' })
  reason?: domain.ServerRejectionReason

  @ApiPropertyOptional({ example: 'courses replicate downward only' })
  detail?: string
}

export class PushResponseDto implements protocol.PushResponse {
  @ApiProperty({
    type: [PushResultDto],
    description: 'One answer per pushed row, in the order the rows were sent.',
  })
  results: protocol.PushResult[]

  @ApiProperty({
    example: 42,
    description: 'Every row of this device up to this outbox id is now in the journal.',
  })
  journaledOutboxId: number
}
