import { asId, type HomeworkId, type LessonVersionId, toIsoDateTime } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aCourse, aLesson, anAnswer, aSchool, aVersion } from '@/shared/data/__tests__/fakeDevice'

import { toHomeworkCards } from '../model'

const held = {
  versions: [aVersion()],
  lessons: [aLesson()],
  courses: [aCourse()],
  schools: [aSchool()],
}

describe('toHomeworkCards', () => {
  it('names the lesson, the course and the school code the answer was written under', () => {
    const cards = toHomeworkCards({ ...held, answers: [anAnswer()] })

    expect(cards[0]).toMatchObject({
      lessonTitle: 'The first lesson',
      courseName: 'Bhagavad Gita',
      schoolCode: 'GITA',
      courseId: 'course-1',
      lessonId: 'lesson-1',
    })
  })

  it('lists the answer whose lesson has not arrived, naming nothing it does not know', () => {
    const elsewhere = anAnswer({ lessonVersionId: asId<LessonVersionId>('version-9') })

    const cards = toHomeworkCards({ ...held, answers: [elsewhere] })

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ lessonTitle: null, courseName: null, lessonId: null })
  })

  it('puts the newest answer first, which is the one being looked for', () => {
    const older = anAnswer({
      id: asId<HomeworkId>('homework-old'),
      createdAt: toIsoDateTime(new Date('2026-01-01T00:00:00.000Z')),
    })
    const newer = anAnswer({
      id: asId<HomeworkId>('homework-new'),
      createdAt: toIsoDateTime(new Date('2026-02-01T00:00:00.000Z')),
    })

    const cards = toHomeworkCards({ ...held, answers: [older, newer] })

    expect(cards.map((card) => card.answer.id)).toEqual(['homework-new', 'homework-old'])
  })
})
