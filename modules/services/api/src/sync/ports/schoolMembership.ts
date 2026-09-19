import { SchoolId, UserId } from '@vidya/domain'

/**
 * Which schools a person belongs to.
 *
 * Half of what opens a school scope — the other half is an accepted place on
 * one of its courses, which `sync` reads for itself. Membership it cannot read
 * for itself: it is a fact about roles, and roles are `edu`'s.
 *
 * So it is asked for as one question rather than taken as a dependency on the
 * context that answers it. The implementation lives where roles live and is
 * bound to this token in the composition root, which is the only place that is
 * allowed to know both sides.
 */
export interface SchoolMembership {
  schoolsOf(userId: UserId): Promise<SchoolId[]>
}

/** Injection token for {@link SchoolMembership}. */
export const SCHOOL_MEMBERSHIP = Symbol('SchoolMembership')
