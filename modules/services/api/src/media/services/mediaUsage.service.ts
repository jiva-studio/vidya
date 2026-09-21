import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { MediaKind, MediaKinds, SchoolId } from '@vidya/domain'
import { Media } from '@vidya/entities'
import { DataSource } from 'typeorm'

/** What a school occupies now, and what it has already been promised room for. */
export type MediaUsage = {
  reservedBytes: number
  countsByKind: Record<MediaKind, number>
}

const noCounts = (): Record<MediaKind, number> =>
  Object.fromEntries(MediaKinds.map((kind) => [kind, 0])) as Record<MediaKind, number>

/**
 * The bytes a school occupies beyond the ones already charged.
 *
 * A grant is a reservation: the quota is checked against what is stored plus
 * what outstanding grants declared, because ten parallel grants each fitting
 * the quota on its own will overfill the bucket together. The reservation
 * disappears with the pending row — charged when it turns ready, dropped when
 * it fails or the sweep takes it.
 */
@Injectable()
export class MediaUsageService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async readUsage(schoolId: SchoolId): Promise<MediaUsage> {
    return {
      reservedBytes: await this.reservedBytesOf(schoolId),
      countsByKind: await this.countsByKindOf(schoolId),
    }
  }

  async reservedBytesOf(schoolId: SchoolId): Promise<number> {
    const rows = await this.dataSource
      .getRepository(Media)
      .find({ where: { schoolId, status: 'pending' }, select: ['sizeBytes'] })

    return rows.reduce((total, row) => total + Number(row.sizeBytes), 0)
  }

  private async countsByKindOf(schoolId: SchoolId): Promise<Record<MediaKind, number>> {
    const rows = await this.dataSource
      .getRepository(Media)
      .find({ where: { schoolId, status: 'ready' }, select: ['kind'] })

    return rows.reduce((counts, row) => {
      counts[row.kind] += 1
      return counts
    }, noCounts())
  }
}
