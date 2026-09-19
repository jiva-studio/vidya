import type { BlockId, QuizBlock } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { insertAnswer, moveAnswer } from '../model'

const quiz = (answers: string[], rightAnswer: number): QuizBlock => ({
  id: 'b1' as unknown as BlockId,
  type: 'quiz',
  question: 'Who is the speaker?',
  answers,
  rightAnswer,
})

describe('inserting an option', () => {
  it('puts the new option directly below the one the author was in', () => {
    const next = insertAnswer(quiz(['Arjuna', 'Krishna', 'Sanjaya'], 0), 0)

    expect(next.answers).toEqual(['Arjuna', '', 'Krishna', 'Sanjaya'])
  })

  it('appends when the author was in the last option', () => {
    const next = insertAnswer(quiz(['Arjuna', 'Krishna'], 0), 1)

    expect(next.answers).toEqual(['Arjuna', 'Krishna', ''])
  })

  it('keeps the same option correct when one is inserted above it', () => {
    const next = insertAnswer(quiz(['Arjuna', 'Krishna'], 1), 0)

    expect(next.answers[next.rightAnswer]).toBe('Krishna')
  })

  it('leaves the correct answer where it is when one is inserted below it', () => {
    const next = insertAnswer(quiz(['Arjuna', 'Krishna'], 0), 1)

    expect(next.rightAnswer).toBe(0)
  })
})

describe('moving an option', () => {
  it('drops the option at the position it was dragged to', () => {
    const next = moveAnswer(quiz(['Arjuna', 'Krishna', 'Sanjaya'], 0), 0, 2)

    expect(next.answers).toEqual(['Krishna', 'Sanjaya', 'Arjuna'])
  })

  it('carries the correct answer with the option that holds it', () => {
    const next = moveAnswer(quiz(['Arjuna', 'Krishna', 'Sanjaya'], 0), 0, 2)

    expect(next.rightAnswer).toBe(2)
    expect(next.answers[next.rightAnswer]).toBe('Arjuna')
  })

  it('shifts the correct answer up when an option from below it is moved above it', () => {
    const next = moveAnswer(quiz(['Arjuna', 'Krishna', 'Sanjaya'], 1), 2, 0)

    expect(next.answers[next.rightAnswer]).toBe('Krishna')
    expect(next.rightAnswer).toBe(2)
  })

  it('shifts the correct answer down when an option from above it is moved below it', () => {
    const next = moveAnswer(quiz(['Arjuna', 'Krishna', 'Sanjaya'], 1), 0, 2)

    expect(next.answers[next.rightAnswer]).toBe('Krishna')
    expect(next.rightAnswer).toBe(0)
  })

  it('leaves the block alone when the drop lands nowhere', () => {
    const before = quiz(['Arjuna', 'Krishna'], 1)

    expect(moveAnswer(before, 0, 5).answers).toEqual(['Arjuna', 'Krishna'])
    expect(moveAnswer(before, -1, 0).answers).toEqual(['Arjuna', 'Krishna'])
    expect(moveAnswer(before, 0, 5).rightAnswer).toBe(1)
  })

  it('returns a new block rather than reordering the one on screen', () => {
    const before = quiz(['Arjuna', 'Krishna'], 0)
    moveAnswer(before, 0, 1)

    expect(before.answers).toEqual(['Arjuna', 'Krishna'])
  })
})
