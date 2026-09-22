import { asId, type CourseId, type EnrollmentId, type SchoolId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aCourse, anEnrollment, aSchool } from '@/shared/data/__tests__/fakeDevice'

import { toCourseCards } from '../model'

const bhakti = aSchool({ id: asId<SchoolId>('school-2'), name: 'Bhakti School', code: 'BHAKTI' })

describe('the courses a student can join', () => {
  it('names the school of every course, so two schools are not one soup', () => {
    const theirs = aCourse({ id: asId<CourseId>('course-2'), schoolId: bhakti.id })

    const cards = toCourseCards([aCourse(), theirs], [aSchool(), bhakti], [])

    expect(cards.map((card) => card.schoolName)).toEqual(['Gita School', 'Bhakti School'])
    expect(cards.map((card) => card.schoolCode)).toEqual(['GITA', 'BHAKTI'])
  })

  it('carries the place the student already holds on a course', () => {
    const cards = toCourseCards([aCourse()], [aSchool()], [anEnrollment({ status: 'pending' })])

    expect(cards[0]?.status).toBe('pending')
  })

  it('leaves a course the student never asked about without a place', () => {
    const elsewhere = anEnrollment({
      id: asId<EnrollmentId>('enrollment-2'),
      courseId: asId<CourseId>('course-2'),
    })

    const cards = toCourseCards([aCourse()], [aSchool()], [elsewhere])

    expect(cards[0]?.status).toBeNull()
  })

  it('answers with the live place where a course was asked about twice', () => {
    const past = anEnrollment({ id: asId<EnrollmentId>('enrollment-0'), status: 'withdrawn' })
    const live = anEnrollment({ status: 'accepted' })

    const cards = toCourseCards([aCourse()], [aSchool()], [past, live])

    expect(cards[0]?.status).toBe('accepted')
  })

  it('keeps a course whose school has not arrived rather than dropping it', () => {
    const cards = toCourseCards([aCourse()], [], [])

    expect(cards).toHaveLength(1)
    expect(cards[0]?.schoolName).toBeNull()
    expect(cards[0]?.schoolCode).toBeNull()
  })

  it('falls back to the first place when no live place exists on the course', () => {
    const past = anEnrollment({ id: asId<EnrollmentId>('enrollment-past'), status: 'withdrawn' })
    const rejected = anEnrollment({ id: asId<EnrollmentId>('enrollment-rej'), status: 'declined' })

    const cards = toCourseCards([aCourse()], [aSchool()], [past, rejected])

    expect(cards[0]?.status).toBe('withdrawn')
  })
})
