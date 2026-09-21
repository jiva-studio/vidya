import type { LocalHomework, LocalLessonVersion, SaveHomeworkAnswer } from '@vidya/client'
import { education, HomeworkFrozenError } from '@vidya/client'
import type { HomeworkStatus, LessonSection } from '@vidya/domain'
import { asId, type BlockId, type HomeworkId, type SectionId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBlockStateWriter, useHomeworkWriter } from '@/shared/data'
import {
  aCourse,
  aLesson,
  anAnswer,
  anEnrollment,
  aSchool,
  aVersion,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
  textOf,
} from '@/shared/data/__tests__/fakeDevice'
import { translate } from '@/shared/i18n'
import { useSyncRuns } from '@/shared/sync'

import LessonPage from '../ui/LessonPage.vue'

const ADDRESS = '/s/GITA/c/course-1/l/lesson-1'

type Assessment = LessonSection['assessment']

const asked = (assessment: Assessment): LocalLessonVersion =>
  aVersion({
    content: {
      schemaVersion: 1,
      sections: [
        {
          id: asId<SectionId>('section-1'),
          title: 'What is taught',
          assessment,
          blocks: [
            {
              id: asId<BlockId>('block-1'),
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

const taught = (assessment: Assessment = 'teacher'): DeviceRows => ({
  schools: [aSchool()],
  courses: [aCourse()],
  lessons: [aLesson()],
  versions: [asked(assessment)],
  enrollments: [anEnrollment()],
})

const render = async (rows: DeviceRows) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(LessonPage, ADDRESS, device.provide)

  await flushPromises()
  return { screen, device }
}

const writesHere = () => {
  const saveAnswer = vi.fn(async (input: SaveHomeworkAnswer) => anAnswer({ ...input }))
  const submit = vi.fn(async (id: HomeworkId) => anAnswer({ id, status: 'pending' }))

  useHomeworkWriter().adoptWriter({ saveAnswer, submit })
  useBlockStateWriter().adoptWriter({ save: vi.fn(async (input) => ({ ...input }) as never) })

  return { saveAnswer, submit }
}

const answered = (over: Partial<LocalHomework> = {}): LocalHomework =>
  anAnswer({ sectionId: asId<SectionId>('section-1'), ...over })

beforeEach(() => {
  siteStandsAt({ filled: true })
  education.useUuidSource(() => 'homework-new')
  useHomeworkWriter().adoptWriter(undefined)
  useBlockStateWriter().adoptWriter(undefined)
  useSyncRuns().adoptRunner(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('the homework a section asks for', () => {
  it('offers a form on a section a person marks', async () => {
    writesHere()
    const { screen } = await render(taught())

    expect(screen.find('textarea').exists()).toBe(true)
  })

  it('offers nothing on a section that asks for no homework', async () => {
    writesHere()
    const { screen } = await render(taught('none'))

    expect(screen.find('textarea').exists()).toBe(false)
    expect(textOf(screen)).not.toContain('Homework for this part')
  })

  it('offers no form on a section the school marks from the quizzes', async () => {
    writesHere()
    const { screen } = await render(taught('auto'))

    expect(screen.find('textarea').exists()).toBe(false)
    expect(textOf(screen)).toContain('marked from your quiz answers')
  })

  it('offers nothing at all to somebody who holds no place on the course', async () => {
    writesHere()
    const { screen } = await render({ ...taught(), enrollments: [] })

    expect(textOf(screen)).not.toContain('Homework for this part')
  })

  it('writes the answer against the section it was written on', async () => {
    const { saveAnswer } = writesHere()
    const { screen } = await render(taught())

    await screen.get('textarea').setValue('The first one, because it does.')
    await screen.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(saveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'homework-new',
        sectionId: 'section-1',
        lessonVersionId: 'version-1',
        text: 'The first one, because it does.',
      }),
    )
  })

  it('hands the answer in, so the school is asked to read it', async () => {
    const { submit } = writesHere()
    const rows = { ...taught(), homework: [answered({ text: 'My first go.' })] }
    const { screen } = await render(rows)

    await screen.findAll('button')[1].trigger('click')
    await flushPromises()

    expect(submit).toHaveBeenCalledWith('homework-1', expect.any(String))
  })

  it('asks for a run, so what was just written does not wait for the next reload', async () => {
    writesHere()
    const run = vi.fn()
    useSyncRuns().adoptRunner(run)
    const { screen } = await render(taught())

    await screen.get('textarea').setValue('Something.')
    await screen.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(run).toHaveBeenCalled()
  })

  it('writes nothing in a tab that does not write the database', async () => {
    const { screen } = await render(taught())

    expect(screen.find('textarea').exists()).toBe(false)
    expect(textOf(screen)).toContain(translate('answer-read-only'))
  })
})

describe('an answer the school already holds', () => {
  const frozen: HomeworkStatus[] = ['pending', 'in_review', 'accepted']

  it.each(frozen)('is not offered for editing while it is %s', async (status) => {
    writesHere()
    const rows = { ...taught(), homework: [answered({ status, text: 'My first go.' })] }
    const { screen } = await render(rows)

    expect(screen.find('textarea').exists()).toBe(false)
    expect(textOf(screen)).toContain('My first go.')
    expect(textOf(screen)).toContain('cannot be changed')
  })

  it('is offered for correction once it has been returned', async () => {
    writesHere()
    const rows = {
      ...taught(),
      homework: [answered({ status: 'returned', text: 'My first go.' })],
    }
    const { screen } = await render(rows)

    expect((screen.get('textarea').element as HTMLTextAreaElement).value).toBe('My first go.')
  })

  it('allows clearing the draft without reverting back to the stored text', async () => {
    writesHere()
    const rows = {
      ...taught(),
      homework: [answered({ status: 'returned', text: 'My first go.' })],
    }
    const { screen } = await render(rows)

    await screen.get('textarea').setValue('')
    await flushPromises()

    expect((screen.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('shows the grade the school put on it', async () => {
    writesHere()
    const rows = { ...taught(), homework: [answered({ status: 'accepted', grade: 80 })] }
    const { screen } = await render(rows)

    expect(textOf(screen)).toContain('80')
  })

  it("shows the reviewer's words, which are the point of a returned answer", async () => {
    writesHere()
    const rows = {
      ...taught(),
      homework: [answered({ status: 'returned', comment: 'Say more about the second verse.' })],
    }
    const { screen } = await render(rows)

    expect(textOf(screen)).toContain('Say more about the second verse.')
  })

  it('says where it stands rather than only that it exists', async () => {
    writesHere()
    const rows = { ...taught(), homework: [answered({ status: 'in_review' })] }
    const { screen } = await render(rows)

    expect(textOf(screen)).toContain('Being read')
  })

  it('does not report the library refusing a write it should never have offered', async () => {
    const saveAnswer = vi.fn(async () => {
      throw new HomeworkFrozenError('accepted')
    })
    useHomeworkWriter().adoptWriter({ saveAnswer, submit: vi.fn() as never })
    const rows = { ...taught(), homework: [answered({ status: 'returned' })] }
    const { screen } = await render(rows)

    await screen.get('textarea').setValue('Another go.')
    await expect(screen.findAll('button')[0].trigger('click')).resolves.toBeUndefined()
  })
})

describe("the school's verdict on a quiz", () => {
  const withVerdict = (correct: boolean, explanation?: string) => ({
    ...taught('none'),
    blockStates: [
      {
        id: 'state-1',
        schoolId: aSchool().id,
        enrollmentId: anEnrollment().id,
        lessonVersionId: aVersion().id,
        blockId: asId<BlockId>('block-1'),
        state: { type: 'quiz', answer: 1 },
        verdict: { correct, explanation },
        updatedAt: anAnswer().createdAt,
      },
    ],
  })

  it('says the answer was wrong', async () => {
    writesHere()
    const { screen } = await render(withVerdict(false))

    expect(screen.get('[data-correct="false"]').text()).toContain('Wrong answer')
  })

  it('says the answer was right', async () => {
    writesHere()
    const { screen } = await render(withVerdict(true))

    expect(screen.get('[data-correct="true"]').text()).toContain('Right answer')
  })

  it('shows the explanation, which the lesson itself never carries', async () => {
    writesHere()
    const { screen } = await render(withVerdict(false, 'The alphabet opens with a vowel.'))

    expect(textOf(screen)).toContain('The alphabet opens with a vowel.')
  })

  it('says nothing about an answer nobody has marked yet', async () => {
    writesHere()
    const rows = {
      ...taught('none'),
      blockStates: [
        {
          id: 'state-1',
          schoolId: aSchool().id,
          enrollmentId: anEnrollment().id,
          lessonVersionId: aVersion().id,
          blockId: asId<BlockId>('block-1'),
          state: { type: 'quiz', answer: 1 },
          verdict: null,
          updatedAt: anAnswer().createdAt,
        },
      ],
    }

    const { screen } = await render(rows)

    expect(screen.find('[data-correct]').exists()).toBe(false)
    expect(textOf(screen)).toContain(translate('lesson-answer-recorded'))
  })
})
