import type { CourseId, EnrollmentId, GroupId } from '@vidya/domain'
import type { HomeworkSummary } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import type { WorkContext } from '../model'
import { filterHomeworkRows, toHomeworkRows } from '../model'

const work = (id: string, enrollmentId: string): HomeworkSummary =>
  ({ id, enrollmentId, sectionId: 's1', status: 'pending' }) as HomeworkSummary

const context: Record<string, WorkContext> = {
  e1: {
    studentName: 'Аня',
    courseId: 'c1' as CourseId,
    groupId: 'g1' as GroupId,
    courseName: 'Курс',
    groupName: 'Группа',
  },
  e2: { studentName: 'Боря', courseId: 'c2' as CourseId },
}

const contextOf = (id: EnrollmentId) => context[id]

describe('homework rows', () => {
  it('names the student through the enrolment the work was handed in against', () => {
    const rows = toHomeworkRows([work('h1', 'e1')], contextOf)

    expect(rows[0].studentName).toBe('Аня')
    expect(rows[0].groupName).toBe('Группа')
  })

  it('keeps a work whose enrolment could not be read', () => {
    const rows = toHomeworkRows([work('h9', 'unknown')], contextOf)

    expect(rows).toHaveLength(1)
    expect(rows[0].studentName).toBeUndefined()
  })

  it('narrows by course and by group', () => {
    const rows = toHomeworkRows([work('h1', 'e1'), work('h2', 'e2')], contextOf)

    expect(filterHomeworkRows(rows, { courseId: 'c2' as CourseId }).map((row) => row.id)).toEqual([
      'h2',
    ])
    expect(filterHomeworkRows(rows, { groupId: 'g1' as GroupId }).map((row) => row.id)).toEqual([
      'h1',
    ])
  })

  it('drops work belonging to another school, and keeps what it cannot place', () => {
    const rows = toHomeworkRows([work('h1', 'e1'), work('h2', 'e2'), work('h3', 'gone')], contextOf)

    const kept = filterHomeworkRows(rows, {}, new Set(['c1' as CourseId]))

    expect(kept.map((row) => row.id)).toEqual(['h1', 'h3'])
  })

  it('narrows nothing when no school directory could be read', () => {
    const rows = toHomeworkRows([work('h1', 'e1'), work('h2', 'e2')], contextOf)

    expect(filterHomeworkRows(rows, {}, new Set())).toHaveLength(2)
  })
})
