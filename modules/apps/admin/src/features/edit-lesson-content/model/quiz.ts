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

const holds = (index: number, length: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < length

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

/** Dropped rather than stored blank, so an untouched field never reaches the wire. */
export const setExplanation = (block: QuizBlock, explanation: string): QuizBlock => {
  const next: QuizBlock = { ...block, explanation }
  if (explanation.trim()) return next

  delete next.explanation
  return next
}

/** Removing an option shifts the right answer with it, or moves it off the gap. */
export const removeAnswer = (block: QuizBlock, index: number): QuizBlock => {
  const answers = block.answers.filter((_, at) => at !== index)
  const shifted = block.rightAnswer > index ? block.rightAnswer - 1 : block.rightAnswer

  return { ...block, answers, rightAnswer: clamped(shifted, answers.length) }
}

/** Opens an empty option below `after`; everything above it keeps its position. */
export const insertAnswer = (block: QuizBlock, after: number): QuizBlock => {
  const at = clamped(after, block.answers.length) + 1
  const answers = [...block.answers.slice(0, at), '', ...block.answers.slice(at)]

  return {
    ...block,
    answers,
    rightAnswer: block.rightAnswer >= at ? block.rightAnswer + 1 : block.rightAnswer,
  }
}

/**
 * Reorders the options, keeping the option that was correct the correct one.
 *
 * The positions are permuted first and the answers read off that permutation, so
 * `rightAnswer` is looked up rather than adjusted by arithmetic: dragging past
 * the right answer shifts it one way and dragging back past it the other, and an
 * off-by-one here is invisible in the editor and marks a student wrong.
 */
export const moveAnswer = (block: QuizBlock, from: number, to: number): QuizBlock => {
  const { answers, rightAnswer } = block
  if (!holds(from, answers.length) || !holds(to, answers.length)) return block

  const order = answers.map((_, at) => at)
  order.splice(to, 0, ...order.splice(from, 1))
  const moved = order.indexOf(rightAnswer)

  return {
    ...block,
    answers: order.map((at) => answers[at]),
    rightAnswer: moved === -1 ? clamped(rightAnswer, answers.length) : moved,
  }
}
