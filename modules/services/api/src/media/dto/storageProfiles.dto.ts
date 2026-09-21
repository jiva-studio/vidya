import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'

const HTTPS_ONLY = { protocols: ['https'], require_protocol: true, require_tld: false }

/**
 * Credentials on their way in.
 *
 * `delivery` is absent on purpose: it is derived from whether a CDN host was
 * given, so offering it as a field would let a school claim a delivery mode its
 * profile cannot perform. `secret` and `tokenSecret` are write-only — nothing
 * reads them back, here or anywhere else.
 */
export class UpsertStorageProfileRequest implements protocol.UpsertStorageProfileRequest {
  @ApiProperty({ example: 's3' })
  @IsIn(domain.StorageProfileKinds)
  kind: domain.StorageProfileKind

  @ApiProperty({ example: 'https://de-s3.storage.bunnycdn.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  endpoint: string

  @ApiProperty({ example: 'de' })
  @IsString()
  @MaxLength(64)
  region: string

  @ApiProperty({ example: 'vidya-demo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bucket: string

  @ApiPropertyOptional({ example: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  prefix?: string

  @ApiProperty({ example: 'vidya-demo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accessKeyId: string

  @ApiProperty({ example: 'the zone password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  secret: string

  @ApiPropertyOptional({ example: 'https://cdn.demo-school.example' })
  @IsOptional()
  @IsUrl(HTTPS_ONLY)
  publicBaseUrl?: string

  @ApiPropertyOptional({ example: 'the token authentication key' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  tokenSecret?: string

  @ApiPropertyOptional({ example: { kind: 'none' } })
  @IsOptional()
  video?: domain.VideoProvider

  @ApiPropertyOptional({ example: 53687091200 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quotaBytes?: number
}

/**
 * The profile on its way out, wrapped so the answer has room to grow a sibling
 * field without moving what a client already reads.
 */
export class StorageProfileResponse {
  constructor(data: protocol.StorageProfileView | null) {
    this.data = data
  }

  @ApiProperty({ nullable: true })
  data: protocol.StorageProfileView | null
}
