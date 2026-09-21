import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

/**
 * What a client declares before a byte moves.
 *
 * The size is declared rather than discovered because the signature is bound to
 * it: a presigned PUT carries no conditions of its own, so signing the declared
 * length is the only thing that stops a grant being a licence to upload a
 * terabyte. Everything declared here is re-read from storage afterwards.
 */
export class CreateUploadRequest implements protocol.CreateUploadRequest {
  @ApiProperty({ example: '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' })
  @IsUUID()
  schoolId: domain.SchoolId

  @ApiProperty({ example: 'image' })
  @IsIn(domain.MediaKinds)
  kind: domain.MediaKind

  @ApiProperty({ example: 'lesson-cover.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(127)
  mimeType: string

  @ApiProperty({ example: 402118 })
  @IsInt()
  @IsPositive()
  sizeBytes: number

  @ApiPropertyOptional({ example: 'qvS1pYTxvE0ByS3+7t7nB3qP0uZ8mM+8Jt2cM6bP0Wc=' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256?: string
}

/** Said once the bytes are in place; the digest is the browser's, when it has one. */
export class CompleteUploadRequest implements protocol.CompleteUploadRequest {
  @ApiPropertyOptional({ example: 'qvS1pYTxvE0ByS3+7t7nB3qP0uZ8mM+8Jt2cM6bP0Wc=' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256?: string
}

/** One page of a school's library. `page` arrives as text on the query string. */
export class MediaQuery implements protocol.MediaQuery {
  @ApiProperty({ example: '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' })
  @IsUUID()
  schoolId: domain.SchoolId

  @ApiPropertyOptional({ example: 'cover' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  term?: string

  @ApiPropertyOptional({ example: 'image' })
  @IsOptional()
  @IsIn(domain.MediaKinds)
  kind?: domain.MediaKind

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number
}

/**
 * How many files one screen may ask about at once.
 *
 * Bounded because the list becomes an `IN` over `media` and a caller that can
 * choose the length of it chooses the cost of the query.
 */
export const MediaResolveLimit = domain.MediaResolveLimit

/** The files a screen is about to draw, asked for before it draws them. */
export class ResolveMediaRequest implements protocol.ResolveMediaRequest {
  @ApiProperty({ example: ['b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091'] })
  @IsArray()
  @ArrayMaxSize(domain.MediaResolveLimit)
  @IsUUID(undefined, { each: true })
  ids: domain.MediaId[]
}
