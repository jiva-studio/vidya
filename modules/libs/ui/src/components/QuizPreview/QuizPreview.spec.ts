import type { BlockId, QuizBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { LessonPreviewLabels } from '../LessonPreview/types'
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
