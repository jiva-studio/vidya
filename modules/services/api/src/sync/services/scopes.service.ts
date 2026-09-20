import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import { SYNC_MAX_SCOPES, SyncScopeGrant } from '@vidya/protocol'
import { DataSource, Repository } from 'typeorm'

import { SyncRequestException } from '../errors'
import { SCHOOL_MEMBERSHIP, SchoolMembership } from '../ports'

/** A scope with the highest position the journal currently holds for it. */
interface ScopeHead {
  scope_kind: string
  scope_id: string
  head: string | null
}

/**
 * What the caller is entitled to read, resolved once per request.
 *
 * Rights are answered here and nowhere else: a pull compares the positions it
 * was sent against this list and drops everything not in it, so a scope the
 * caller has no claim to cannot be reached by asking for it. The
 * journal itself carries no permissions — the addressee was stamped when the
 * row was written — which is exactly why the caller's rights have to be decided
 * before the first row is read.
 *
 * A student's world is three kinds of scope: their own rows, the schools they
 * belong to, and the courses they hold an accepted place on. A place that is
 * still pending, or was declined, grants nothing: it is a request, not a seat.
 *
 * A school is reached two ways — by a role in it, or by an accepted place on
 * one of its courses — because either alone leaves a hole: a student accepted
 * onto a course of a school that gave them no role would receive its lessons
 * with no course to hang them on.
 */
@Injectable()
export class SyncScopesService {
  constructor(
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @Inject(SCHOOL_MEMBERSHIP) private readonly membership: SchoolMembership,
    private readonly dataSource: DataSource,
  ) {}

  /** The scopes the caller may read, without their positions. */
  async scopesFor(userId: domain.UserId): Promise<domain.SyncScopeRef[]> {
    const accepted = await this.enrollments.findBy({ studentId: userId, status: 'accepted' })
    const byRole = await this.membership.schoolsOf(userId)

    const schools = [...new Set([...byRole, ...accepted.map((place) => place.schoolId)])].map(
      (id): domain.SyncScopeRef => ({ kind: 'school', id }),
    )

    // A student who took a course twice still holds one course. `SYNC_MAX_SCOPES`
    // counts what is granted, so a name repeated spends another scope's budget.
    const courses = [...new Set(accepted.map((place) => place.courseId))].map(
      (id): domain.SyncScopeRef => ({ kind: 'course', id }),
    )

    return [{ kind: 'user', id: userId }, ...schools, ...courses]
  }

  /**
   * The same scopes with the head of each, which is what the wire carries.
   *
   * A scope with nothing in the journal yet still appears, at `0`: the device
   * needs to know the scope exists so it can start following it, and a course
   * whose content has not been published is a real and ordinary state.
   *
   * `SYNC_MAX_SCOPES` bounds what is granted and not only what is asked for,
   * because the device sends a position back for every scope it was granted.
   * Granting more than a request may carry would work once, on the empty
   * cursors of a first run, and refuse every pull after it. The contract says a
   * list over the ceiling is an error with a reason and never a silent
   * truncation, so the refusal is raised here rather than the tail dropped.
   */
  async grantsFor(userId: domain.UserId): Promise<SyncScopeGrant[]> {
    const scopes = await this.scopesFor(userId)

    if (scopes.length > SYNC_MAX_SCOPES) {
      throw new SyncRequestException(
        'tooManyScopes',
        `the caller holds ${scopes.length} scopes; at most ${SYNC_MAX_SCOPES} fit in one request`,
      )
    }

    const heads = await this.heads(scopes)

    return scopes.map((scope) => ({
      scope,
      headSeq: heads.get(domain.syncScopeKey(scope)) ?? 0,
    }))
  }

  /**
   * The highest `global_seq` each scope holds.
   *
   * One grouped query for every scope rather than one query per scope: a
   * student on a dozen courses would otherwise pay a round trip each, on every
   * pull, for a number whose only job is to say "you are up to date".
   */
  private async heads(scopes: readonly domain.SyncScopeRef[]): Promise<Map<string, number>> {
    if (scopes.length === 0) return new Map()

    const conditions = scopes
      .map((_, index) => `(scope_kind = $${index * 2 + 1} AND scope_id = $${index * 2 + 2})`)
      .join(' OR ')

    const rows: ScopeHead[] = await this.dataSource.query(
      `SELECT scope_kind, scope_id, max(global_seq) AS head
         FROM sync_journal
        WHERE ${conditions}
        GROUP BY scope_kind, scope_id`,
      scopes.flatMap((scope) => [scope.kind, scope.id]),
    )

    return new Map(rows.map((row) => [`${row.scope_kind}:${row.scope_id}`, Number(row.head ?? 0)]))
  }
}
