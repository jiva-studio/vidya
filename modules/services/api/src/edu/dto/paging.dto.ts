import { ApiPropertyOptional } from '@nestjs/swagger'
import * as protocol from '@vidya/protocol'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/** The most one request may ask for at a time. */
export const MAX_PAGE_SIZE = 100

/**
 * What every list takes to return one page of itself.
 *
 * A base class rather than a mixin because `class-validator` reads decorators
 * off the prototype chain: extending it is what carries the rules.
 */
export class PagedQuery implements protocol.PageQuery {
  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}

/**
 * The slice a list controller asks the repository for.
 *
 * Nothing when the caller named no limit. These endpoints feed pickers and
 * name lookups as well as screens — a default page size would silently cut
 * those to their first rows, which reads as data quietly going missing.
 */
export const pageOf = (query: protocol.PageQuery) =>
  query.limit === undefined ? {} : { take: query.limit, skip: query.offset ?? 0 }
