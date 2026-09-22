import { SchoolId, StorageDelivery, StorageProfileId, StorageProvider } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/** One AES-256-GCM value: base64 ciphertext and the nonce it was sealed under. */
export type SealedText = {
  ciphertext: string
  nonce: string
}

/**
 * The credentials of one profile, sealed as a single document.
 *
 * Two layers, rotated on different schedules: `dek` is this row's data key
 * wrapped under the installation master key named by `keyVersion`, and the
 * storage secret and the CDN token secret are sealed under that data key. The
 * school and the profile ids are the additional data of every value here, so a
 * document carried into another row does not open.
 *
 * Base64 rather than bytes because the column is `json`, and because a raw
 * buffer parameter is text to some of the drivers this schema is read through —
 * text means UTF-8, which silently replaces every byte above 0x7F, and a
 * ciphertext that has been through that no longer opens.
 */
export type StorageSecrets = {
  keyVersion: number
  dek: SealedText
  secret: SealedText
  tokenSecret: SealedText | null
}

/**
 * Where a school's files live, and the sealed credentials that reach them.
 *
 * A row is written once and never edited: new credentials mean a new row, the
 * previous one gets `retiredAt`, and the school points at the new one. Files
 * already uploaded name the profile that wrote them, so a rotation leaves them
 * readable instead of orphaning everything the school has published.
 *
 * Neither what the school may store nor what it already stores is here. The
 * ceiling is policy and lives in `school_storage_quotas`; the occupied bytes
 * are the sum of the school's ready files, which cannot drift the way a counter
 * on an immutable row does. `accessKeyId` is deliberately in the clear: it
 * names the credential without being one, and a refusal has to be explainable
 * without the secret.
 */
@Entity({ name: 'storage_profiles' })
export class StorageProfile {
  @PrimaryGeneratedColumn('uuid')
  id: StorageProfileId

  // Null for the installation's own bucket, which every school without keys of
  // its own writes into: one row, lent under each school's prefix.
  @Column({ type: 'uuid', nullable: true })
  schoolId: SchoolId | null

  @Column({ type: 'character varying', nullable: false })
  provider: StorageProvider

  @Column({ type: 'character varying', nullable: false, default: '' })
  region: string

  @Column({ type: 'character varying', nullable: false })
  bucket: string

  @Column({ type: 'character varying', nullable: false, default: '' })
  prefix: string

  @Column({ type: 'character varying', nullable: false })
  accessKeyId: string

  // Only 's3-compatible' fills this in; for the named providers the address is
  // derived from the provider, the region and the account.
  @Column({ type: 'character varying', nullable: true })
  endpoint: string | null

  // R2 addresses by account and has no regions, so it cannot borrow `region`.
  @Column({ type: 'character varying', nullable: true })
  r2AccountId: string | null

  @Column({ type: 'json', nullable: false })
  secrets: StorageSecrets

  @Column({ type: 'character varying', nullable: false, default: 'presigned' })
  delivery: StorageDelivery

  @Column({ type: 'character varying', nullable: true })
  publicBaseUrl: string | null

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
