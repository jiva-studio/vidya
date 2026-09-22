import { MediaId, MediaKind, MediaStatus, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/**
 * An uploaded file: the row exists before its bytes, and outlives a refusal.
 *
 * The id is part of the object key, so the row is written before an upload can
 * be signed. While the row is pending, `sizeBytes` is what the client declared
 * and the quota reserves it; when the row turns ready the number is replaced
 * with what storage reported, which is the only size ever trusted.
 *
 * `profileId` names the credentials the object is read through rather than the
 * school's current ones: a school that changes bucket keeps every file it has
 * already published readable.
 */
@Entity({ name: 'media' })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: MediaId

  @Column({ type: 'uuid', nullable: false })
  schoolId: SchoolId

  @Column({ type: 'uuid', nullable: false })
  profileId: StorageProfileId

  @Column({ type: 'character varying', nullable: false })
  kind: MediaKind

  @Column({ type: 'character varying', nullable: false, default: 'pending' })
  status: MediaStatus

  @Column({ type: 'character varying', nullable: false })
  storageKey: string

  // Set only when the bytes are not ours: a video provider holds them and
  // names them its own way.
  @Column({ type: 'character varying', nullable: true })
  externalId: string | null

  @Column({ type: 'character varying', nullable: false })
  name: string

  @Column({ type: 'character varying', nullable: false })
  mimeType: string

  @Column({ type: 'bigint', nullable: false, default: 0 })
  sizeBytes: string

  @Column({ type: 'character varying', length: 64, nullable: true })
  sha256: string | null

  @Column({ type: 'integer', nullable: true })
  width: number | null

  @Column({ type: 'integer', nullable: true })
  height: number | null

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null

  @Column({ type: 'uuid', nullable: true })
  posterMediaId: MediaId | null

  @Column({ type: 'uuid', nullable: false })
  createdBy: UserId

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null
}
