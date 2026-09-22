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
  Matches,
  MaxLength,
} from 'class-validator'

const HTTPS_ONLY = { protocols: ['https'], require_protocol: true, require_tld: false }

/**
 * Credentials on their way in.
 *
 * `delivery` is absent on purpose: it is derived from whether a CDN host was
 * given, so offering it as a field would let a school claim a delivery mode its
 * profile cannot perform. `endpoint` is optional here and refused further in
 * for every provider whose host we compose ourselves, which no field decorator
 * can express. `secret` and `tokenSecret` are write-only — nothing reads them
 * back, here or anywhere else. An absent `prefix` means the default one, and a
 * blank one means nothing at all: it would name every object in the bucket,
 * another school's included, so it is refused rather than read as absent.
 */
export class UpsertStorageProfileRequest implements protocol.UpsertStorageProfileRequest {
  @ApiProperty({ example: 's3-compatible' })
  @IsIn(domain.StorageProviders)
  provider: domain.StorageProvider

  @ApiPropertyOptional({ example: 'https://de-s3.storage.bunnycdn.com' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  endpoint?: string

  @ApiProperty({ example: 'de' })
  @IsString()
  @MaxLength(64)
  region: string

  @ApiPropertyOptional({ example: 'a1b2c3d4e5f60718293a4b45cd6e7f80' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  r2AccountId?: string

  @ApiProperty({ example: 'vidya-demo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bucket: string

  @ApiPropertyOptional({ example: 'school/6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'prefix must name a folder, not the whole bucket' })
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
