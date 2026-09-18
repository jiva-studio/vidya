import type { QuizBlock } from '@vidya/domain'

/**
 * The right answer is an index, so every change to the list has to carry it.
 *
 * A dangling `rightAnswer` is invisible in the editor and wrong on the student's
 * screen: the quiz marks the wrong option, or none at all. The index is moved
 * with the list here rather than in the component that happens to delete a row.
 */
const clamped = (index: number, length: number): number => {
  if (length === 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

export const addAnswer = (block: QuizBlock): QuizBlock => ({
  ...block,
  answers: [...block.answers, ''],
})

export const setAnswer = (block: QuizBlock, index: number, text: string): QuizBlock => ({
  ...block,
  answers: block.answers.map((answer, at) => (at === index ? text : answer)),
})

export const setRightAnswer = (block: QuizBlock, index: number): QuizBlock => ({
  ...block,
  rightAnswer: clamped(index, block.answers.length),
})

export const setQuestion = (block: QuizBlock, question: string): QuizBlock => ({
  ...block,
  question,
})

/** Removing an option shifts the right answer with it, or moves it off the gap. */
export const removeAnswer = (block: QuizBlock, index: number): QuizBlock => {
  const answers = block.answers.filter((_, at) => at !== index)
  const shifted = block.rightAnswer > index ? block.rightAnswer - 1 : block.rightAnswer

  return { ...block, answers, rightAnswer: clamped(shifted, answers.length) }
}
