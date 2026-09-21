import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { SchoolId } from '@vidya/domain'
import { SchoolStorageQuota } from '@vidya/entities'
import { DataSource } from 'typeorm'

/**
 * What a school may store.
 *
 * The ceiling lives beside the school rather than on its storage profile: a
 * profile is retired and replaced whenever a key is rotated, so a ceiling kept
 * there would be re-entered on every rotation and lost by anyone who rotated
 * without repeating it.
 */
@Injectable()
export class StorageQuotasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * The ceiling a school has been given, or nothing when none was ever set.
   *
   * A row holding null is not the same answer as no row at all: the first says
   * the school was deliberately left uncapped, the second that nobody has
   * decided, which is what lets a school on the installation's storage fall
   * back to the default.
   */
  async findQuotaBytes(schoolId: SchoolId): Promise<number | null | undefined> {
    const row = await this.dataSource
      .getRepository(SchoolStorageQuota)
      .findOne({ where: { schoolId } })

    if (!row) return undefined

    return row.quotaBytes === null ? null : Number(row.quotaBytes)
  }

  async setQuotaBytes(schoolId: SchoolId, quotaBytes: number | null): Promise<void> {
    await this.dataSource.getRepository(SchoolStorageQuota).upsert(
      {
        schoolId,
        quotaBytes: quotaBytes === null ? null : String(quotaBytes),
        updatedAt: new Date(),
      },
      ['schoolId'],
    )
  }
}
