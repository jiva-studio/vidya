import type { BlockId, LessonContent, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LessonPreview from './LessonPreview.vue'
import type { LessonPreviewLabels, LessonProgress } from './types'

const labels: LessonPreviewLabels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const section = (id: string, title: string, blocks: unknown[]) => ({
  id: asId<SectionId>(id),
  title,
  assessment: 'none',
  blocks,
})

const text = (id: string, content: string) => ({
  id: asId<BlockId>(id),
  type: 'text',
  content,
})

const lesson = (sections: unknown[]): LessonContent =>
  ({ schemaVersion: 1, sections }) as unknown as LessonContent

const draw = (content: LessonContent) => mount(LessonPreview, { props: { content, labels } })

describe('LessonPreview', () => {
  it('draws the sections in the order the lesson lists them', () => {
    const page = draw(
      lesson([
        section('s1', 'The alphabet', [text('b1', 'First')]),
        section('s2', 'The vowels', [text('b2', 'Second')]),
      ]),
    )

    const titles = page.findAll('h3').map((title) => title.text())

    expect(titles).toEqual(['The alphabet', 'The vowels'])
  })

  it('draws the blocks of a section in the order the section lists them', () => {
    const page = draw(
      lesson([section('s1', 'The alphabet', [text('b1', 'First'), text('b2', 'Second')])]),
    )

    expect(page.text().indexOf('First')).toBeLessThan(page.text().indexOf('Second'))
  })

  it('names a section that has no title with the words it was given', () => {
    const page = draw(lesson([section('s1', '', [text('b1', 'Anything')])]))

    expect(page.get('h3').text()).toBe('Untitled section')
  })

  it('names a block kind it cannot draw, so a reader is not left with a gap', () => {
    const page = draw(
      lesson([section('s1', 'The alphabet', [{ id: asId<BlockId>('b1'), type: 'image' }])]),
    )

    expect(page.text()).toContain('Unknown block of kind image.')
  })

  it('draws nothing at all for a lesson without sections', () => {
    expect(draw(lesson([])).findAll('article')).toEqual([])
  })
})

const quiz = (id: string) => ({
  id: asId<BlockId>(id),
  type: 'quiz',
  question: 'Which letter opens the alphabet?',
  answers: ['The first one', 'The last one'],
  rightAnswer: 0,
})

const studying = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  states: {},
  editable: true,
  verdicts: {},
  labels: {
    markRead: 'Mark as read',
    answerRecorded: 'Your answer is in.',
    answerCorrect: 'Right',
    answerIncorrect: 'Wrong',
  },
  ...over,
})

const study = (content: LessonContent, progress: LessonProgress) =>
  mount(LessonPreview, { props: { content, labels, progress } })

describe('LessonPreview as the student reads it', () => {
  it('carries what the student has done down to the block that shows it', () => {
    const content = lesson([section('s1', 'The alphabet', [quiz('b1')])])
    const answered = studying({ states: { [asId<BlockId>('b1')]: { type: 'quiz', answer: 0 } } })

    expect(study(content, answered).text()).toContain('Your answer is in.')
  })

  it('carries a change back up under the name of the block it happened on', async () => {
    const content = lesson([section('s1', 'The alphabet', [text('b1', 'First'), quiz('b2')])])
    const page = study(content, studying())

    await page.findAll('input[type="radio"]')[1].setValue(true)

    expect(page.emitted('change')).toEqual([['b2', { type: 'quiz', answer: 1 }]])
  })

  it('draws the author their own lesson, with nothing on it to answer', () => {
    const content = lesson([section('s1', 'The alphabet', [quiz('b1')])])

    expect(draw(content).findAll('input')).toEqual([])
  })
})

describe('LessonPreview as a screen hangs its own things on it', () => {
  it('gives each section a place of its own, named after that section', () => {
    const content = lesson([
      section('s1', 'The alphabet', [text('b1', 'First')]),
      section('s2', 'The numerals', [text('b2', 'Second')]),
    ])

    const page = mount(LessonPreview, {
      props: { content, labels },
      slots: { section: '<p class="under">under {{ params.section.title }}</p>' },
    })

    expect(page.findAll('.under').map((note) => note.text())).toEqual([
      'under The alphabet',
      'under The numerals',
    ])
  })

  it('draws the section in full without one, which is how the console reads it', () => {
    const content = lesson([section('s1', 'The alphabet', [text('b1', 'First')])])

    const page = mount(LessonPreview, { props: { content, labels } })

    expect(page.text()).toContain('The alphabet')
    expect(page.find('.under').exists()).toBe(false)
  })
})
