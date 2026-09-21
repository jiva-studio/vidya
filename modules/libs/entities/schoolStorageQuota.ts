import { SchoolId } from '@vidya/domain'
import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * How much a school may store, and nothing about how much it does.
 *
 * Policy sits apart from the storage profile because a profile is never edited:
 * new keys retire the row, and a ceiling attached to it would be re-entered —
 * or lost — every time a school rotated a credential. `quotaBytes` null means
 * no ceiling of ours, which is what a school paying its own provider gets.
 */
@Entity({ name: 'school_storage_quotas' })
export class SchoolStorageQuota {
  @PrimaryColumn({ type: 'uuid' })
  schoolId: SchoolId

  @Column({ type: 'bigint', nullable: true })
  quotaBytes: string | null

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date
}
