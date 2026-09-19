import type { CourseId, GroupId, UserId } from '@vidya/domain'
import type { EnrollmentSummary } from '@vidya/protocol'

import type { EnrollmentDetailsById, EnrollmentRow } from './types'

/** Everything the table needs beside the summaries themselves. */
export interface RowSources {
  details: EnrollmentDetailsById
  names: Map<UserId, string>
  courseNames: Map<CourseId, string>
  groupNames: Map<GroupId, string>
}

/**
 * Joins a page of summaries to what was resolved for them.
 *
 * A row whose name or course has not arrived yet is still a row: the table
 * shows what it has and fills the rest in when the requests land.
 */
export const toEnrollmentRows = (
  items: EnrollmentSummary[],
  sources: RowSources,
): EnrollmentRow[] =>
  items.map((item) => {
    const resolved = sources.details.get(item.id)

    return {
      ...item,
      studentId: resolved?.studentId,
      studentName: resolved ? sources.names.get(resolved.studentId) : undefined,
      courseName: sources.courseNames.get(item.courseId),
      groupName: item.groupId ? sources.groupNames.get(item.groupId) : undefined,
      decidedByName: resolved?.decidedById ? sources.names.get(resolved.decidedById) : undefined,
      decidedAt: resolved?.decidedAt,
      inQueue: item.status === 'accepted' && !item.groupId,
    }
  })
