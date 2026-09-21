import type { CourseId, GroupId, UserId } from '@vidya/domain'
import type { EnrollmentSummary } from '@vidya/protocol'

import type { EnrollmentDetailsById, EnrollmentRow, ResolvedEnrollment } from './types'

/** Everything the table needs beside the summaries themselves. */
export interface RowSources {
  details: EnrollmentDetailsById
  names: Map<UserId, string>
  courseNames: Map<CourseId, string>
  groupNames: Map<GroupId, string>
}

// The stamp arrives as an absent field rather than as `null`, so the question
// asked here is whether there is a value at all.
const inSchoolSight = (row: EnrollmentRow): boolean => !row.archivedBySchoolAt

/**
 * Puts the attempts of one student on one course together, newest first.
 *
 * The same name on two lines is a history and not a list printed twice, and it
 * only reads as one when the attempts sit side by side in the order they were
 * made. A student nobody has been named for yet stands alone rather than
 * joining every other unnamed row.
 */
const asHistory = (rows: EnrollmentRow[]): EnrollmentRow[] => {
  const attempts = new Map<string, EnrollmentRow[]>()

  for (const row of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = `${row.studentId ?? row.id}|${row.courseId}`
    const made = attempts.get(key)
    if (made) made.push(row)
    else attempts.set(key, [row])
  }

  return [...attempts.values()].flat()
}

const whoFrom = (resolved: ResolvedEnrollment | undefined, names: Map<UserId, string>) => ({
  studentId: resolved?.studentId,
  studentName: resolved ? names.get(resolved.studentId) : undefined,
  decidedByName: resolved?.decidedById ? names.get(resolved.decidedById) : undefined,
  decidedAt: resolved?.decidedAt,
})

const askedFrom = (resolved: ResolvedEnrollment | undefined) => ({
  preferredGroupId: resolved?.preferredGroupId,
  preferredTimes: resolved?.preferredTimes,
  comment: resolved?.comment,
  archivedBySchoolAt: resolved?.archivedBySchoolAt,
})

const toRow = (item: EnrollmentSummary, sources: RowSources): EnrollmentRow => {
  const resolved = sources.details.get(item.id)

  return {
    ...item,
    ...whoFrom(resolved, sources.names),
    ...askedFrom(resolved),
    courseName: sources.courseNames.get(item.courseId),
    groupName: item.groupId ? sources.groupNames.get(item.groupId) : undefined,
    inQueue: item.status === 'accepted' && !item.groupId,
  }
}

/**
 * Joins a page of summaries to what was resolved for them.
 *
 * A row whose name or course has not arrived yet is still a row: the table
 * shows what it has and fills the rest in when the requests land. A row the
 * school has put away leaves this list and no other — the student keeps theirs.
 */
export const toEnrollmentRows = (
  items: EnrollmentSummary[],
  sources: RowSources,
): EnrollmentRow[] => asHistory(items.map((item) => toRow(item, sources)).filter(inSchoolSight))
