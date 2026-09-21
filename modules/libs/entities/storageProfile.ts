import {
  SchoolId,
  StorageDelivery,
  StorageProfileId,
  StorageProfileKind,
  VideoProvider,
} from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn, ValueTransformer } from 'typeorm'

/**
 * Sealed bytes as they sit in a `bytea` column: base64, not raw.
 *
 * The encoding costs a third more space and buys the one thing that matters
 * for a ciphertext — the bytes come back exactly as they went in. A raw buffer
 * parameter is text to some of the drivers this schema is read through,
 * including the in-memory one the suites run on, and text means UTF-8, which
 * silently replaces every byte above 0x7F. A ciphertext that has been through
 * that no longer opens, and nothing says so until someone tries.
 */
const sealedBytes: ValueTransformer = {
  to: (value: Buffer | null) => (value ? Buffer.from(value.toString('base64'), 'ascii') : null),
  from: (value: Buffer | null) => (value ? Buffer.from(value.toString('ascii'), 'base64') : null),
}

/**
 * Where a school's files live, and the sealed credentials that reach them.
 *
 * A row is written once and never edited: new credentials mean a new row, the
 * previous one gets `retiredAt`, and the school points at the new one. Files
 * already uploaded name the profile that wrote them, so a rotation leaves them
 * readable instead of orphaning everything the school has published.
 *
 * The secret never rests in the clear. `dekCiphertext` holds this row's data
 * key sealed under the installation master key named by `keyVersion`, and
 * `secretCiphertext` holds the secret sealed under that data key with the
 * school and the profile as additional data — which is what makes a ciphertext
 * copied into another row unreadable rather than merely misplaced.
 * `accessKeyId` is deliberately in the clear: it names the credential without
 * being one, and a refusal has to be explainable without the secret.
 *
 * `usedBytes` counts this profile rather than the school: the bytes are in the
 * bucket the profile names, so a school that moves starts counting again while
 * the retired row keeps the count of what it still holds.
 */
@Entity({ name: 'storage_profiles' })
export class StorageProfile {
  @PrimaryGeneratedColumn('uuid')
  id: StorageProfileId

  // Null names the storage of the installation, which is configured from the
  // environment and has no row here; the column exists so one query shape
  // serves both.
  @Column({ type: 'uuid', nullable: true })
  schoolId: SchoolId | null

  @Column({ type: 'character varying', nullable: false, default: 's3' })
  kind: StorageProfileKind

  @Column({ type: 'character varying', nullable: false })
  endpoint: string

  @Column({ type: 'character varying', nullable: false, default: '' })
  region: string

  @Column({ type: 'character varying', nullable: false })
  bucket: string

  @Column({ type: 'character varying', nullable: false, default: '' })
  prefix: string

  @Column({ type: 'character varying', nullable: false })
  accessKeyId: string

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  secretCiphertext: Buffer | null

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  secretNonce: Buffer | null

  @Column({ type: 'integer', nullable: false, default: 1 })
  keyVersion: number

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  dekCiphertext: Buffer | null

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  dekNonce: Buffer | null

  @Column({ type: 'character varying', nullable: false, default: 'presigned' })
  delivery: StorageDelivery

  @Column({ type: 'character varying', nullable: true })
  publicBaseUrl: string | null

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  tokenSecretCiphertext: Buffer | null

  @Column({ type: 'bytea', nullable: true, transformer: sealedBytes })
  tokenSecretNonce: Buffer | null

  @Column({ type: 'json', nullable: false, default: { kind: 'none' } })
  video: VideoProvider

  @Column({ type: 'bigint', nullable: true })
  quotaBytes: string | null

  @Column({ type: 'bigint', nullable: false, default: 0 })
  usedBytes: string

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null

  @Column({ type: 'character varying', nullable: true })
  verifyError: string | null

  @Column({ type: 'timestamptz', nullable: true })
  retiredAt: Date | null

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  updatedAt: Date
}
