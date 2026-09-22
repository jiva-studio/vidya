import { decideHomework } from '@vidya/api/edu/services/homeworkReview'
import * as domain from '@vidya/domain'
import { BlockState, Homework, LessonVersion } from '@vidya/entities'
import { EntityManager, In } from 'typeorm'

import { withoutSyncWriteContext } from '../../journal'

/** The whole of a grade, so a share of right answers becomes a percentage. */
const FULL_MARK = 100

const sectionHolding = (
  content: domain.LessonContent,
  blockId: domain.BlockId,
): domain.LessonSection | undefined =>
  content.sections.find((section) => section.blocks.some((block) => block.id === blockId))

const quizzesOf = (section: domain.LessonSection): domain.QuizBlock[] =>
  section.blocks.filter((block): block is domain.QuizBlock => block.type === 'quiz')

/**
 * What the server says about one answer, read from the published content.
 *
 * The key is here and nowhere else: the copy a student downloads has it
 * stripped, so the comparison can only be made on this side and the answer can
 * only be marked as it arrives. A block that is not a quiz has nothing to mark.
 */
const verdictFor = (
  version: LessonVersion,
  blockId: domain.BlockId,
  state: domain.LessonBlockState,
): domain.QuizVerdict | null => {
  if (state.type !== 'quiz') return null

  const section = sectionHolding(version.content, blockId)
  const quiz = section && quizzesOf(section).find((block) => block.id === blockId)

  if (!quiz) return null

  const correct = quiz.rightAnswer === state.answer

  return quiz.explanation ? { correct, explanation: quiz.explanation } : { correct }
}

/**
 * Marks an answer that has just been written, and the section it completes.
 *
 * Both writes are the server's own, so they leave the push's identity behind:
 * see {@link withoutSyncWriteContext}. They stay inside the caller's
 * transaction, which is what lets the count below see the verdict written a
 * statement earlier.
 */
export const markAnswer = async (
  manager: EntityManager,
  answer: BlockState,
  version: LessonVersion,
  now: Date,
): Promise<void> => {
  const verdict = verdictFor(version, answer.blockId, answer.state)

  if (!verdict) return

  await withoutSyncWriteContext(async () => {
    answer.verdict = verdict

    await manager.save(BlockState, answer)
    await recordSection(manager, answer, version, now)
  })
}

/**
 * Records the work of a section the machine marks, once none of it is left.
 *
 * A section a person owns is never touched: their verdict on a quiz is
 * self-assessment, and the status of their homework is the reviewer's to move.
 */
const recordSection = async (
  manager: EntityManager,
  answer: BlockState,
  version: LessonVersion,
  now: Date,
): Promise<void> => {
  const section = sectionHolding(version.content, answer.blockId)

  if (section?.assessment !== 'auto') return

  const quizzes = quizzesOf(section)
  const verdicts = await verdictsOn(manager, answer, quizzes)

  if (verdicts.length < quizzes.length) return

  const right = verdicts.filter((verdict) => verdict.correct).length
  const work = await workOn(manager, answer, section, version)

  // Work a person has already accepted is theirs, and the machine does not
  // mark it a second time.
  if (!domain.canTransitionHomework(work.status, 'accepted')) return

  manager.merge(
    Homework,
    work,
    decideHomework(work, {
      status: 'accepted',
      grade: Math.round((right / quizzes.length) * FULL_MARK),
      reviewedById: null,
      at: now,
    }),
  )

  await manager.save(Homework, work)
}

/** The verdicts this student has earned across the quizzes of one section. */
const verdictsOn = async (
  manager: EntityManager,
  answer: BlockState,
  quizzes: readonly domain.QuizBlock[],
): Promise<domain.QuizVerdict[]> => {
  const states = await manager.findBy(BlockState, {
    enrollmentId: answer.enrollmentId,
    lessonVersionId: answer.lessonVersionId,
    blockId: In(quizzes.map((quiz) => quiz.id)),
  })

  return states.map((state) => state.verdict).filter(Boolean)
}

/**
 * The row the section's work lives in, created here when there is none.
 *
 * Nothing is handed in to an automatically marked section, so nobody else ever
 * creates it: it is born handed in, and the transition above is what carries it
 * to its outcome.
 */
const workOn = async (
  manager: EntityManager,
  answer: BlockState,
  section: domain.LessonSection,
  version: LessonVersion,
): Promise<Homework> => {
  const existing = await manager.findOneBy(Homework, {
    enrollmentId: answer.enrollmentId,
    lessonVersionId: answer.lessonVersionId,
    sectionId: section.id,
  })

  if (existing) return existing

  return manager.create(Homework, {
    enrollmentId: answer.enrollmentId,
    lessonVersionId: version.id,
    sectionId: section.id,
    schoolId: answer.schoolId,
    status: 'pending',
    text: '',
    answeredSupersededVersion: false,
  })
}
