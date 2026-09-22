import { asId, type HomeworkId, type SectionId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { anAnswer, aVersion } from '@/shared/data/__tests__/fakeDevice'

import { recordHomeworkAnswer } from '../model'

const version = aVersion()
const enrollmentId = anAnswer().enrollmentId

const record = (answer: ReturnType<typeof anAnswer> | null, text = 'My answer.') =>
  recordHomeworkAnswer({
    version,
    enrollmentId,
    sectionId: asId<SectionId>('section-1'),
    answer,
    text,
    mintId: () => asId<HomeworkId>('homework-new'),
  })

describe('recordHomeworkAnswer', () => {
  it('writes the answer against the version the student was reading', () => {
    expect(record(null)).toEqual({
      id: 'homework-new',
      schoolId: version.schoolId,
      enrollmentId,
      lessonVersionId: version.id,
      sectionId: 'section-1',
      text: 'My answer.',
    })
  })

  it('writes a correction onto the answer already there rather than a second one', () => {
    const written = anAnswer({ id: asId<HomeworkId>('homework-1'), status: 'returned' })

    expect(record(written, 'My second go.')).toMatchObject({
      id: 'homework-1',
      text: 'My second go.',
    })
  })
})
