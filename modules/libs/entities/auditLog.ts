import { AuditLogId, SchoolId, UserId } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Namespaced `<context>.<action>[.<outcome>]`, so the table can grow into
 * contexts beyond `auth` without colliding on a bare verb.
 *
 * The authentication events are wired from
 * `auth/controllers/tokens.controller.ts` and
 * `auth/controllers/user-authentication.controller.ts`. The `edu` events are
 * wired from `RolesService` and `SchoolCreationService`, and
 * `media.role.storageGranted` from `RolesService` as well.
 */
export type AuditAction =
  | 'auth.signIn.success'
  | 'auth.signIn.failure'
  | 'auth.signOut'
  | 'auth.token.refresh'
  | 'edu.role.assigned'
  | 'edu.role.removed'
  | 'edu.role.created'
  | 'edu.role.permissionsUpdated'
  | 'edu.role.deleted'
  | 'edu.school.created'
  | 'media.role.storageGranted'
  | 'media.storage.configured'
  | 'media.storage.retired'
  | 'media.storage.verifyFailed'
  | 'media.deleted'

/**
 * One recorded action: who did it (or tried to), what they did, what it
 * touched, and when. The only trace of a security-relevant action once
 * TypeORM's query log was turned off by default (#26).
 *
 * No foreign keys to `users` or `schools`: a row must outlive the account or
 * school it describes, the same reasoning `sync_journal` uses. `actorUserId`
 * and `actorLogin` are two columns rather than one doing both jobs, because a
 * failed sign-in has a login but no user — forcing that case into a nullable
 * user id column would mean the column's type lies about what it holds.
 * `subjectType`/`subjectId` are a plain pair rather than a foreign key for the
 * mirror reason: an `edu` event's subject can be a role, a school or a user,
 * and one column cannot reference three tables.
 *
 * Never put a credential in `payload` — no OTP code, no access or refresh
 * token, not even truncated. This table is the trail an attacker's reach is
 * measured by; it must never become a second copy of what it is guarding.
 */
@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: AuditLogId

  @Column({ nullable: false })
  action: AuditAction

  @Column({ type: 'uuid', nullable: true })
  actorUserId: UserId | null

  @Column({ type: 'character varying', nullable: true })
  actorLogin: string | null

  /** What kind of row `subjectId` names — `'user'`, `'role'`, `'school'`, and so on. */
  @Column({ type: 'character varying', nullable: true })
  subjectType: string | null

  @Column({ type: 'uuid', nullable: true })
  subjectId: string | null

  @Column({ type: 'uuid', nullable: true })
  schoolId: SchoolId | null

  // Only as trustworthy as the reverse proxy in front of this service; recorded
  // as reported by the runtime, never treated as an authenticated identity.
  @Column({ type: 'character varying', nullable: true })
  sourceAddress: string | null

  @Column({ type: 'json', nullable: false, default: {} })
  payload: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  occurredAt: Date
}
