import { ApiProperty } from '@nestjs/swagger'
import * as protocol from '@vidya/protocol'
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator'

/**
 * What a device has applied, across every scope.
 *
 * One number rather than a map, unlike the read positions: this is not where
 * the device reads from, it is how far it is safe to compact the journal, and
 * compaction is global. Answered with `204` and no body.
 */
export class AckCursorRequestDto implements protocol.AckCursorRequest {
  @ApiProperty({ example: 'device-8f2a6c14' })
  @IsString()
  @IsNotEmpty()
  deviceId: string

  @ApiProperty({ example: 1302, description: 'The highest serverSeq this device has applied.' })
  @IsInt()
  @Min(0)
  ackedSeq: number
}
