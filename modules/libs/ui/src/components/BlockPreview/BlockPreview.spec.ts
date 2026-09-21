import type { BlockId, LessonBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { LessonPreviewLabels, LessonProgress } from '../LessonPreview/types'
import BlockPreview from './BlockPreview.vue'

const labels: LessonPreviewLabels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const reading = (over: Partial<LessonProgress> = {}): LessonProgress => ({
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

const text = {
  id: asId<BlockId>('b1'),
  type: 'text',
  content: 'The alphabet opens with a vowel.',
} as LessonBlock

const quiz = {
  id: asId<BlockId>('b2'),
  type: 'quiz',
  question: 'Which letter opens the alphabet?',
  answers: ['The first one', 'The last one'],
  rightAnswer: 0,
} as LessonBlock

const draw = (block: LessonBlock, progress?: LessonProgress) =>
  mount(BlockPreview, { props: { block, labels, progress } })

describe('BlockPreview', () => {
  it('offers a text block to be marked read once the lesson belongs to the student', () => {
    const page = draw(text, reading())

    expect(page.get('input[type="checkbox"]').isVisible()).toBe(true)
    expect(page.text()).toContain('Mark as read')
  })

  it('offers nothing to mark on the copy its author is looking at', () => {
    const page = draw(text)

    expect(page.findAll('input')).toEqual([])
  })

  it('reports a text block as read, named by the block it belongs to', async () => {
    const page = draw(text, reading())

    await page.get('input[type="checkbox"]').setValue(true)

    expect(page.emitted('change')).toEqual([['b1', { type: 'text', read: true }]])
  })

  it('keeps a block that is read marked, and asks for it only once', () => {
    const page = draw(text, reading({ states: { [text.id]: { type: 'text', read: true } } }))
    const mark = page.get('input[type="checkbox"]')

    expect((mark.element as HTMLInputElement).checked).toBe(true)
    expect(mark.attributes('disabled')).toBeDefined()
  })

  it('marks nothing read in a tab that may not write', () => {
    const page = draw(text, reading({ editable: false }))

    expect(page.get('input[type="checkbox"]').attributes('disabled')).toBeDefined()
  })

  it('names the block an answer came from, which the quiz alone does not know', async () => {
    const page = draw(quiz, reading())

    await page.findAll('input[type="radio"]')[0].setValue(true)

    expect(page.emitted('change')).toEqual([['b2', { type: 'quiz', answer: 0 }]])
  })
})
