import type { BlockId, QuizBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { addAnswer, removeAnswer, setAnswer, setQuestion, setRightAnswer } from '../model'

const quiz = (answers: string[], rightAnswer: number): QuizBlock => ({
  id: asId<BlockId>('b1'),
  type: 'quiz',
  question: 'Which one?',
  answers,
  rightAnswer,
})

describe('quiz answers', () => {
  it('adds, edits and marks answers', () => {
    const block = quiz(['a', 'b'], 0)

    expect(addAnswer(block).answers).toEqual(['a', 'b', ''])
    expect(setAnswer(block, 1, 'B').answers).toEqual(['a', 'B'])
    expect(setRightAnswer(block, 1).rightAnswer).toBe(1)
    expect(setQuestion(block, 'Why?').question).toBe('Why?')
  })

  it('moves the right answer down when an earlier one is deleted', () => {
    expect(removeAnswer(quiz(['a', 'b', 'c'], 2), 0)).toMatchObject({
      answers: ['b', 'c'],
      rightAnswer: 1,
    })
  })

  it('leaves the right answer alone when a later one is deleted', () => {
    expect(removeAnswer(quiz(['a', 'b', 'c'], 0), 2)).toMatchObject({
      answers: ['a', 'b'],
      rightAnswer: 0,
    })
  })

  it('never leaves the right answer pointing past the list', () => {
    expect(removeAnswer(quiz(['a', 'b'], 1), 1)).toMatchObject({ answers: ['a'], rightAnswer: 0 })
    expect(removeAnswer(quiz(['a'], 0), 0)).toMatchObject({ answers: [], rightAnswer: 0 })
  })

  it('refuses to mark an option that does not exist', () => {
    expect(setRightAnswer(quiz(['a', 'b'], 0), 7).rightAnswer).toBe(1)
    expect(setRightAnswer(quiz(['a', 'b'], 0), -3).rightAnswer).toBe(0)
  })
})
