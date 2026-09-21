import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { toMediaSummary } from '@vidya/api/media/mappers'
import { Media } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { DataSource, ILike } from 'typeorm'

/**
 * How many files one page of the library holds.
 *
 * Fixed here rather than chosen by the caller: the number is part of the shape
 * the gallery lays out against, and a page size a client can ask for is a page
 * size that can be asked to return the whole library.
 */
export const MediaPageSize = 24

/**
 * One school's library, listed.
 *
 * Only `ready` rows are listed: a pending row has no bytes behind it and a
 * failed one never will, so either in a gallery is a broken thumbnail. The
 * school is a filter on the query rather than a scope checked afterwards —
 * filtering a page that has already been cut to twenty-four leaves another
 * school's files taking up room in this one's page.
 */
@Injectable()
export class MediaCatalogService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findPage(query: protocol.MediaQuery): Promise<protocol.MediaPage> {
    const page = query.page && query.page > 0 ? query.page : 1

    const [rows, total] = await this.dataSource.getRepository(Media).findAndCount({
      where: {
        schoolId: query.schoolId,
        status: 'ready',
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.term ? { name: ILike(`%${query.term}%`) } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * MediaPageSize,
      take: MediaPageSize,
    })

    return { items: rows.map(toMediaSummary), total, page, pageSize: MediaPageSize }
  }
}
