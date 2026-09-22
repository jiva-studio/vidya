import type { BlockId, QuizBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { LessonPreviewLabels, LessonProgress } from '../LessonPreview/types'
import QuizPreview from './QuizPreview.vue'

const labels: LessonPreviewLabels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const block = (over: Partial<QuizBlock> = {}): QuizBlock =>
  ({
    id: asId<BlockId>('b1'),
    type: 'quiz',
    question: 'Which letter opens the alphabet?',
    answers: ['The first one', 'The last one'],
    rightAnswer: 0,
    ...over,
  }) as QuizBlock

const draw = (over: Partial<QuizBlock> = {}, named = labels) =>
  mount(QuizPreview, { props: { block: block(over), labels: named } })

describe('QuizPreview', () => {
  it('asks the question and offers every answer', () => {
    const page = draw()

    expect(page.text()).toContain('Which letter opens the alphabet?')
    expect(page.findAll('li').map((answer) => answer.get('span').text())).toEqual([
      'The first one',
      'The last one',
    ])
  })

  it('marks the key when the screen has a word for it', () => {
    const answers = draw({ rightAnswer: 1 }).findAll('li')

    expect(answers[0].text()).not.toContain('right answer')
    expect(answers[1].text()).toContain('right answer')
  })

  it('marks nothing when the screen names no key, which is what a student sees', () => {
    const page = draw({}, { ...labels, rightAnswer: undefined })

    expect(page.text()).not.toContain('right answer')
    expect(page.findAll('span')).toHaveLength(3)
  })

  it('never shows the explanation, which is withheld until an answer is in', () => {
    const page = draw({ explanation: 'The alphabet opens with a vowel.' })

    expect(page.text()).not.toContain('The alphabet opens with a vowel.')
  })

  it('says a question is still missing rather than showing an empty line', () => {
    expect(draw({ question: '' }).text()).toContain('No question yet.')
  })
})

const answering = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  states: {},
  verdicts: {},
  editable: true,
  labels: {
    markRead: 'Mark as read',
    answerRecorded: 'Your answer is in.',
    answerCorrect: 'Right',
    answerIncorrect: 'Wrong',
  },
  ...over,
})

const ask = (progress: LessonProgress, over: Partial<QuizBlock> = {}) =>
  mount(QuizPreview, { props: { block: block(over), labels, progress } })

describe('QuizPreview as the student answers it', () => {
  it('offers every answer to choose from', () => {
    const page = ask(answering())

    expect(page.findAll('input[type="radio"]')).toHaveLength(2)
  })

  it('reports the answer chosen rather than judging it here', async () => {
    const page = ask(answering())

    await page.findAll('input[type="radio"]')[1].setValue(true)

    expect(page.emitted('change')).toEqual([[{ type: 'quiz', answer: 1 }]])
  })

  it('names no key on the copy the student answers, whatever the screen offers', () => {
    const page = ask(answering(), { rightAnswer: 1 })

    expect(page.text()).not.toContain('right answer')
  })

  it('takes one answer and no second one', async () => {
    const answered = answering({ states: { [block().id]: { type: 'quiz', answer: 0 } } })
    const page = ask(answered)

    const options = page.findAll('input[type="radio"]')

    expect(options[0].attributes('disabled')).toBeDefined()
    expect(options[1].attributes('disabled')).toBeDefined()
    expect(page.text()).toContain('Your answer is in.')
  })

  it('shows which answer was given, so the student reads their own back', () => {
    const answered = answering({ states: { [block().id]: { type: 'quiz', answer: 1 } } })

    const options = ask(answered).findAll('input[type="radio"]')

    expect((options[0].element as HTMLInputElement).checked).toBe(false)
    expect((options[1].element as HTMLInputElement).checked).toBe(true)
  })

  it('takes no answer in a tab that may not write', () => {
    const page = ask(answering({ editable: false }))

    expect(page.find('input[type="radio"]').attributes('disabled')).toBeDefined()
  })
})

const given = (answer: number) => ({ states: { [block().id]: { type: 'quiz' as const, answer } } })

describe('QuizPreview once the school has marked the answer', () => {
  it('says the answer was right', () => {
    const page = ask(answering({ ...given(0), verdicts: { [block().id]: { correct: true } } }))

    expect(page.get('[data-correct="true"]').text()).toBe('Right')
  })

  it('says the answer was wrong rather than leaving the student to guess', () => {
    const page = ask(answering({ ...given(1), verdicts: { [block().id]: { correct: false } } }))

    expect(page.get('[data-correct="false"]').text()).toBe('Wrong')
  })

  it('shows the explanation, which travels only with the verdict', () => {
    const verdict = { correct: false, explanation: 'The alphabet opens with a vowel.' }
    const page = ask(answering({ ...given(1), verdicts: { [block().id]: verdict } }))

    expect(page.text()).toContain('The alphabet opens with a vowel.')
  })

  it('drops the promise of an answer to come once the answer is here', () => {
    const page = ask(answering({ ...given(0), verdicts: { [block().id]: { correct: true } } }))

    expect(page.text()).not.toContain('Your answer is in.')
  })

  it('keeps a verdict off a block this student never answered', () => {
    const page = ask(answering({ verdicts: { [block().id]: { correct: true } } }))

    expect(page.find('[data-correct]').exists()).toBe(false)
  })
})
