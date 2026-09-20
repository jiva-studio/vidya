import { LiveEnrollmentStatuses } from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import { FindOptionsWhere, IsNull, Raw } from 'typeorm'

/**
 * Which places each side is shown, as the database runs it.
 *
 * Each side tidies its own list and neither tidies the other's: a row the
 * school put away is still the student's explanation of why their access went,
 * and a row the student put away is still the school's record of what it
 * decided. The two stamps therefore live in two columns and are read by two
 * predicates that share nothing.
 *
 * Both are `where` objects rather than a query builder, because the school's
 * side has to compose with the scope of the caller, and that scope is expressed
 * as a `where` object and nowhere else.
 */

/**
 * Names the column beside the one a `Raw` fragment was handed.
 *
 * TypeORM passes the property path under the current alias — `Enrollment.foo`
 * when the repository is queried plainly, the join alias when it is not — and
 * rewrites both into real columns afterwards. Replacing the property keeps
 * whatever alias the query actually chose, which cutting the alias off by hand
 * would not survive.
 */
const siblingOf = (path: string, property: keyof Enrollment): string =>
  `${path.slice(0, path.lastIndexOf('.') + 1)}${property}`

/**
 * A student sees everything but a finished row they put away themselves.
 *
 * The second half of the rule is a guard, not a condition the correctness rests
 * on: the server refuses a stamp on a live row. It is here because a place the
 * student still holds, hidden by a bug, cannot be brought back from a phone.
 */
export const visibleToStudent = (): FindOptionsWhere<Enrollment> => ({
  archivedByStudentAt: Raw(
    (archivedAt) =>
      `(${archivedAt} IS NULL OR ${siblingOf(archivedAt, 'status')} IN (:...liveStatuses))`,
    { liveStatuses: [...LiveEnrollmentStatuses] },
  ),
})

/** A school sees everything but what it put away itself. */
export const visibleToSchool = (): FindOptionsWhere<Enrollment> => ({
  archivedBySchoolAt: IsNull(),
})
