import type { LocalBlockState, LocalLessonVersion, SaveBlockState } from '@vidya/client'
import { education } from '@vidya/client'
import {
  asId,
  type BlockId,
  type CourseId,
  type LessonId,
  type LessonVersionId,
} from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBlockStateWriter } from '@/shared/data'
import {
  aBlockState,
  aCourse,
  aLesson,
  anEnrollment,
  aSchool,
  aVersion,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
} from '@/shared/data/__tests__/fakeDevice'
import { translate } from '@/shared/i18n'
import { useSyncRuns } from '@/shared/sync'

import LessonPage from '../ui/LessonPage.vue'

const ADDRESS = '/s/GITA/c/course-1/l/lesson-1'

const withQuiz = (schemaVersion = 1): LocalLessonVersion =>
  aVersion({
    content: {
      schemaVersion,
      sections: [
        {
          id: asId('section-1'),
          title: 'What is taught',
          assessment: 'none',
          blocks: [
            { id: asId<BlockId>('block-1'), type: 'text', content: 'Read left to right.' },
            {
              id: asId<BlockId>('block-2'),
              type: 'quiz',
              question: 'Which letter opens the alphabet?',
              answers: ['The first one', 'The last one'],
              rightAnswer: 0,
            },
          ],
        },
      ],
    },
  })

const taught: DeviceRows = {
  schools: [aSchool()],
  courses: [aCourse()],
  lessons: [aLesson()],
  versions: [withQuiz()],
  enrollments: [anEnrollment()],
}

const render = async (rows: DeviceRows = taught, path = ADDRESS) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(LessonPage, path, device.provide)

  await flushPromises()
  return { screen, device }
}

const writesHere = () => {
  const save = vi.fn(async (input: SaveBlockState) => ({ ...input }) as LocalBlockState)
  useBlockStateWriter().adoptWriter({ save })
  return save
}

describe('one lesson', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    // The composition root names the rows this machine creates; a test that
    // records progress creates one.
    education.useUuidSource(() => 'state-new')
    useBlockStateWriter().adoptWriter(undefined)
    useSyncRuns().adoptRunner(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('draws the lesson this machine holds, under its own title', async () => {
    writesHere()
    const { screen } = await render()

    expect(screen.text()).toContain('The first lesson')
    expect(screen.text()).toContain('Read left to right.')
    expect(screen.text()).toContain('Which letter opens the alphabet?')
  })

  it('records a block the student has read', async () => {
    const save = writesHere()
    const { screen } = await render()

    await screen.get('input[type="checkbox"]').setValue(true)
    await flushPromises()

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: 'enrollment-1',
        lessonVersionId: 'version-1',
        blockId: 'block-1',
        state: { type: 'text', read: true },
      }),
    )
  })

  it('asks for a run, so what was just recorded does not wait for the next reload', async () => {
    writesHere()
    const run = vi.fn()
    useSyncRuns().adoptRunner(run)
    const { screen } = await render()

    await screen.get('input[type="checkbox"]').setValue(true)
    await flushPromises()

    expect(run).toHaveBeenCalled()
  })

  it('records the answer the student gave to a quiz', async () => {
    const save = writesHere()
    const { screen } = await render()

    await screen.findAll('input[type="radio"]')[1].setValue(true)
    await flushPromises()

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'block-2', state: { type: 'quiz', answer: 1 } }),
    )
  })

  it('takes one answer to a quiz and offers no second one', async () => {
    writesHere()
    const answered = aBlockState({
      id: 'state-2',
      blockId: asId<BlockId>('block-2'),
      state: { type: 'quiz', answer: 0 },
    })

    const { screen } = await render({ ...taught, blockStates: [answered] })

    expect(screen.findAll('input[type="radio"]')[0].attributes('disabled')).toBeDefined()
    expect(screen.findAll('input[type="radio"]')[1].attributes('disabled')).toBeDefined()
  })

  it('records nothing in a tab that does not write the database', async () => {
    const { screen } = await render()

    expect(screen.get('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(screen.text()).toContain(translate('lesson-read-only'))
  })

  it('records nothing for a student who holds no place on the course', async () => {
    writesHere()
    const { screen } = await render({ ...taught, enrollments: [] })

    expect(screen.text()).toContain('Which letter opens the alphabet?')
    expect(screen.findAll('input')).toEqual([])
  })

  it('offers an update rather than half a lesson it cannot read', async () => {
    writesHere()
    const { screen } = await render({ ...taught, versions: [withQuiz(2)] })

    expect(screen.text()).not.toContain('Which letter opens the alphabet?')
    expect(screen.text()).toContain('newer than this page')
    expect(screen.get('button').text()).toContain('Reload')
  })

  it('says the lesson is not open to them rather than that it does not exist', async () => {
    const { screen } = await render({ ...taught, versions: [] })

    expect(screen.text()).toContain(translate('lesson-absent-title'))
  })

  it('promises the lesson is coming while no run has finished here', async () => {
    siteStandsAt()
    const { screen } = await render({ ...taught, versions: [] })

    expect(screen.text()).toContain('Your courses are on their way')
    expect(screen.text()).not.toContain(translate('lesson-absent-title'))
  })

  it('refuses a lesson of another course pasted under this address', async () => {
    const elsewhere = aLesson({ courseId: asId<CourseId>('course-2'), title: 'Another course' })

    const { screen } = await render({ ...taught, lessons: [elsewhere] })

    expect(screen.text()).not.toContain('Another course')
    expect(screen.text()).toContain(translate('lesson-absent-title'))
  })

  it('reads the lesson back after recording, so the screen shows what was written', async () => {
    writesHere()
    const { screen, device } = await render()

    await screen.get('input[type="checkbox"]').setValue(true)
    await flushPromises()

    expect(device.education.blockStates.listByLessonVersion).toHaveBeenCalledTimes(2)
  })

  it('names the lesson the address asks for and not the first one of the course', async () => {
    const second = aLesson({
      id: asId<LessonId>('lesson-2'),
      lessonNumber: 2,
      title: 'The second lesson',
    })

    const itsOwn = aVersion({
      id: asId<LessonVersionId>('version-2'),
      lessonId: asId<LessonId>('lesson-2'),
    })

    const { screen } = await render(
      { ...taught, lessons: [aLesson(), second], versions: [withQuiz(), itsOwn] },
      '/s/GITA/c/course-1/l/lesson-2',
    )

    expect(screen.text()).toContain('The second lesson')
    expect(screen.text()).not.toContain('The first lesson')
  })
})
