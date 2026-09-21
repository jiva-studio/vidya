import { asId, type CourseId, type EnrollmentId, type SchoolId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aCourse, anEnrollment, aSchool } from '@/shared/data/__tests__/fakeDevice'

import { toLearningCards } from '../model'

describe('the courses a student holds a place on', () => {
  it('names the school each course belongs to', () => {
    const cards = toLearningCards([anEnrollment()], [aCourse()], [aSchool()])

    expect(cards[0]?.schoolName).toBe('Gita School')
    expect(cards[0]?.schoolCode).toBe('GITA')
    expect(cards[0]?.courseName).toBe('Bhagavad Gita')
  })

  it('keeps the place of a course that has not arrived yet', () => {
    const cards = toLearningCards([anEnrollment()], [], [aSchool()])

    expect(cards).toHaveLength(1)
    expect(cards[0]?.courseName).toBeNull()
  })

  it('leaves the address out when the school itself has no code here', () => {
    const cards = toLearningCards([anEnrollment()], [aCourse()], [aSchool({ code: null })])

    expect(cards[0]?.schoolCode).toBeNull()
  })

  it('carries what became of the place, so the card can say it', () => {
    const cards = toLearningCards([anEnrollment({ status: 'pending' })], [aCourse()], [aSchool()])

    expect(cards[0]?.status).toBe('pending')
  })

  it('gathers the places of every school into one list', () => {
    const bhakti = aSchool({
      id: asId<SchoolId>('school-2'),
      name: 'Bhakti School',
      code: 'BHAKTI',
    })
    const theirs = aCourse({ id: asId<CourseId>('course-2'), schoolId: asId<SchoolId>('school-2') })

    const cards = toLearningCards(
      [
        anEnrollment(),
        anEnrollment({
          id: asId<EnrollmentId>('enrollment-2'),
          schoolId: bhakti.id,
          courseId: theirs.id,
        }),
      ],
      [aCourse(), theirs],
      [aSchool(), bhakti],
    )

    expect(cards.map((card) => card.schoolName)).toEqual(['Gita School', 'Bhakti School'])
  })
})
