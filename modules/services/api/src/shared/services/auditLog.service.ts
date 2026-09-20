import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as domain from '@vidya/domain'
import { AuditAction, AuditLog } from '@vidya/entities'
import { EntityManager, Repository } from 'typeorm'

export type AuditLogEntry = {
  action: AuditAction
  actorUserId?: domain.UserId | null
  actorLogin?: string | null
  subjectType?: string | null
  subjectId?: string | null
  schoolId?: domain.SchoolId | null
  sourceAddress?: string | null
  payload?: Record<string, unknown>
}

@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repository: Repository<AuditLog>) {}

  /**
   * Writes one audit entry.
   *
   * Pass `manager` when the action being audited runs inside a transaction the
   * entry must share — a rolled-back change must leave no row, and a
   * committed one must always have its own. That is how the `edu` call sites
   * (role assignment, role removal, school creation) will use this once they
   * are wired up. Authentication events have no surrounding transaction, so
   * they call this with no manager and accept that a write can be lost, same
   * as any other fire-and-forget insert.
   *
   * Never put a credential in `entry.payload` — an OTP code, an access or
   * refresh token, not even truncated. This table is the trail an attacker's
   * reach is measured by; it must never become a second copy of what it is
   * guarding.
   */
  async record(entry: AuditLogEntry, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditLog) : this.repository
    await repository.insert({
      action: entry.action,
      actorUserId: entry.actorUserId ?? null,
      actorLogin: entry.actorLogin ?? null,
      subjectType: entry.subjectType ?? null,
      subjectId: entry.subjectId ?? null,
      schoolId: entry.schoolId ?? null,
      sourceAddress: entry.sourceAddress ?? null,
      payload: entry.payload ?? {},
    })
  }
}
