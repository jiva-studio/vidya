import { asId, type EnrollmentId, type LessonId, type LessonVersionId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aBlockState, aLesson, aVersion, fakeDevice } from '@/shared/data/__tests__/fakeDevice'

import { readLessonProgress } from '../model'

const lessons = [
  aLesson(),
  aLesson({ id: asId<LessonId>('lesson-2'), lessonNumber: 2, title: 'The second' }),
]

describe('the lessons of a course with their progress', () => {
  it('reads the states the student wrote against the version they hold', async () => {
    const device = fakeDevice({ versions: [aVersion()], blockStates: [aBlockState()] })

    const rows = await readLessonProgress({
      lessons,
      enrollmentId: asId<EnrollmentId>('enrollment-1'),
      education: device.education,
    })

    expect(rows.map((row) => row.done)).toEqual([1, 0])
  })

  it('counts nothing for a student who holds no place on the course', async () => {
    const device = fakeDevice({ versions: [aVersion()], blockStates: [aBlockState()] })

    const rows = await readLessonProgress({
      lessons,
      enrollmentId: null,
      education: device.education,
    })

    expect(rows.map((row) => row.done)).toEqual([0, 0])
    expect(device.education.blockStates.listByLessonVersion).not.toHaveBeenCalled()
  })

  it('lists a lesson whose version has not arrived rather than leaving it out', async () => {
    const device = fakeDevice({ versions: [] })

    const rows = await readLessonProgress({
      lessons,
      enrollmentId: asId<EnrollmentId>('enrollment-1'),
      education: device.education,
    })

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => !row.held)).toBe(true)
  })

  it('counts against a published version only, never a draft the device kept', async () => {
    const device = fakeDevice({
      versions: [
        aVersion({ id: asId<LessonVersionId>('version-2'), version: 2, status: 'draft' }),
        aVersion(),
      ],
    })

    const rows = await readLessonProgress({
      lessons,
      enrollmentId: asId<EnrollmentId>('enrollment-1'),
      education: device.education,
    })

    expect(rows[0]?.blocks).toBe(2)
  })
})
