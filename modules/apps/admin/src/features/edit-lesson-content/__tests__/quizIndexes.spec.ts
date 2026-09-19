import type { QuizBlock } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { insertAnswer, moveAnswer, removeAnswer, setRightAnswer } from '../model/quiz'

const quiz = (answers: string[], rightAnswer: number): QuizBlock =>
  ({ id: 'q1', type: 'quiz', question: 'Who speaks?', answers, rightAnswer }) as unknown as QuizBlock

/** The option the block marks correct, which is what a student is graded against. */
const correct = (block: QuizBlock): string | undefined => block.answers[block.rightAnswer]

const four = () => quiz(['A', 'B', 'C', 'D'], 2)

describe('the option that stays correct through one edit', () => {
  it('survives an insert above it', () => {
    expect(correct(insertAnswer(four(), 0))).toBe('C')
  })

  it('survives an insert directly above it', () => {
    expect(correct(insertAnswer(four(), 1))).toBe('C')
  })

  it('survives an insert directly below it', () => {
    expect(correct(insertAnswer(four(), 2))).toBe('C')
  })

  it('survives an insert at the end', () => {
    expect(correct(insertAnswer(four(), 3))).toBe('C')
  })

  it('survives the removal of an option above it', () => {
    expect(correct(removeAnswer(four(), 0))).toBe('C')
  })

  it('survives the removal of an option below it', () => {
    expect(correct(removeAnswer(four(), 3))).toBe('C')
  })

  it('survives a drag from above it to below it', () => {
    expect(correct(moveAnswer(four(), 0, 3))).toBe('C')
  })

  it('survives a drag from below it to above it', () => {
    expect(correct(moveAnswer(four(), 3, 0))).toBe('C')
  })

  it('travels with the correct option dragged to the front', () => {
    const moved = moveAnswer(four(), 2, 0)

    expect(moved.rightAnswer).toBe(0)
    expect(correct(moved)).toBe('C')
  })

  it('travels with the correct option dragged to the back', () => {
    const moved = moveAnswer(four(), 2, 3)

    expect(moved.rightAnswer).toBe(3)
    expect(correct(moved)).toBe('C')
  })
})

describe('the option that stays correct through a run of edits', () => {
  it('holds through an insert, a drag and a removal', () => {
    const inserted = insertAnswer(four(), 0)
    const dragged = moveAnswer(inserted, 4, 1)
    const shortened = removeAnswer(dragged, 0)

    expect(correct(shortened)).toBe('C')
  })

  it('holds through a drag there and back again', () => {
    const there = moveAnswer(four(), 2, 0)
    const back = moveAnswer(there, 0, 2)

    expect(back.answers).toEqual(['A', 'B', 'C', 'D'])
    expect(back.rightAnswer).toBe(2)
  })

  it('holds through every single-step drag, whichever way it goes', () => {
    for (let from = 0; from < 4; from += 1) {
      for (let to = 0; to < 4; to += 1) {
        expect(correct(moveAnswer(four(), from, to))).toBe('C')
      }
    }
  })
})

describe('the answer index is never left pointing nowhere', () => {
  it('stays inside the list when the correct option is itself removed', () => {
    const shortened = removeAnswer(four(), 2)

    expect(shortened.rightAnswer).toBeGreaterThanOrEqual(0)
    expect(shortened.rightAnswer).toBeLessThan(shortened.answers.length)
  })

  it('stays inside the list when the last option is removed from the end', () => {
    const shortened = removeAnswer(quiz(['A', 'B'], 1), 1)

    expect(shortened.rightAnswer).toBe(0)
  })

  it('refuses an index that is not a position at all', () => {
    expect(setRightAnswer(four(), -1).rightAnswer).toBe(0)
    expect(setRightAnswer(four(), 9).rightAnswer).toBe(3)
  })

  it('leaves the block untouched when a drag lands outside the list', () => {
    expect(moveAnswer(four(), 0, 9)).toEqual(four())
    expect(moveAnswer(four(), -1, 0)).toEqual(four())
    expect(moveAnswer(four(), 1.5, 0)).toEqual(four())
  })
})
