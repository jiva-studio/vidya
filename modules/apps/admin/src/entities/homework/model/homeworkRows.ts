import type { CourseId } from '@vidya/domain'
import type { HomeworkSummary } from '@vidya/protocol'

import type { ContextLookup, HomeworkFilters, HomeworkRow } from './types'

/** Joins a page of works to the enrolments they were handed in against. */
export const toHomeworkRows = (items: HomeworkSummary[], contextOf: ContextLookup): HomeworkRow[] =>
  items.map((item) => ({ ...item, ...(contextOf(item.enrollmentId) ?? {}) }))

/**
 * Narrows the queue by course and by group.
 *
 * Status is the server's to filter; these two are not. `GetHomeworkQuery`
 * carries a group the controller never reads, and carries no course at all, so
 * a queue that offered those filters over the wire would answer with the whole
 * list and look like it had filtered it.
 */
export const filterHomeworkRows = (
  rows: HomeworkRow[],
  filters: HomeworkFilters,
  schoolCourses?: Set<CourseId>,
): HomeworkRow[] =>
  rows.filter(
    (row) =>
      inSchool(row, schoolCourses) &&
      (!filters.courseId || row.courseId === filters.courseId) &&
      (!filters.groupId || row.groupId === filters.groupId),
  )

/**
 * Whether a work belongs to the school on screen.
 *
 * The list endpoint answers with every school the reviewer may read, so work
 * from another one has to be dropped here (AC-6). Work whose course could not
 * be resolved at all is kept: a reviewer without `enrollments:read` resolves
 * nothing, and an empty queue would be a worse answer than an unattributed one.
 */
const inSchool = (row: HomeworkRow, schoolCourses?: Set<CourseId>): boolean =>
  !schoolCourses || schoolCourses.size === 0 || !row.courseId || schoolCourses.has(row.courseId)
