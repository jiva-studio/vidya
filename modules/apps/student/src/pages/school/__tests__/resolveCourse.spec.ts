import { asId, type CourseId, type SchoolId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aCourse, aSchool } from '@/shared/data/__tests__/fakeDevice'

import { resolveCourse } from '../model'

describe('the course an address names', () => {
  it('answers with the course when the school teaches it', () => {
    expect(resolveCourse(aCourse(), aSchool())?.name).toBe('Bhagavad Gita')
  })

  it('refuses a course of another school pasted under this code', () => {
    const theirs = aCourse({ id: asId<CourseId>('course-2'), schoolId: asId<SchoolId>('school-2') })

    expect(resolveCourse(theirs, aSchool())).toBeNull()
  })

  it('answers with nothing when either half is not on this machine', () => {
    expect(resolveCourse(null, aSchool())).toBeNull()
    expect(resolveCourse(aCourse(), null)).toBeNull()
  })
})
