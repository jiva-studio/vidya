import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { SchoolId } from '@vidya/domain'
import { SchoolStorageQuota } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { StorageFailedError } from '../storageFailure'

/**
 * A `bigint` ceiling as a number, or a refusal.
 *
 * The column holds more than a JSON number carries, and `Number()` rounds the
 * excess away without saying so: nothing downstream could tell the answer apart
 * from the ceiling somebody set. Nine petabytes is past any school library, so
 * the answer to one is a refusal rather than a wider type on the wire.
 */
const exactBytes = (stored: string): number => {
  const bytes = Number(stored)

  if (!Number.isSafeInteger(bytes) || String(bytes) !== stored.trim()) {
    throw new StorageFailedError('quota-unreadable')
  }

  return bytes
}

/**
 * What a school may store.
 *
 * The ceiling lives beside the school rather than on its storage profile: a
 * profile is retired and replaced whenever a key is rotated, so a ceiling kept
 * there would be re-entered on every rotation and lost by anyone who rotated
 * without repeating it.
 */
/**
 * The ceiling a school stores under, given what was decided for it.
 *
 * A school nobody has decided about stores under the installation's default,
 * unless it brought keys of its own: one paying its own provider is limited by
 * that provider rather than by us, while one writing into the installation's
 * bucket is spending room the installation pays for.
 */
export const quotaBytesFor = (
  decided: number | null | undefined,
  ownCredentials: boolean,
  installationDefault: number,
): number | null => {
  if (decided !== undefined) return decided

  return ownCredentials ? null : installationDefault
}

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

    return row.quotaBytes === null ? null : exactBytes(String(row.quotaBytes))
  }

  /**
   * Refuses a ceiling past what a number carries exactly, before anything has
   * been written: it arrived through a JSON parser that had already rounded it,
   * so storing it would record a ceiling nobody asked for.
   */
  assertSettable(quotaBytes: number | null | undefined): void {
    if (quotaBytes === null || quotaBytes === undefined) return
    if (!Number.isSafeInteger(quotaBytes)) throw new StorageFailedError('quota-unreadable')
  }

  async setQuotaBytes(schoolId: SchoolId, quotaBytes: number | null): Promise<void> {
    this.assertSettable(quotaBytes)

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
