import type { LocalHomework, LocalLessonVersion, SaveHomeworkAnswer } from '@vidya/client'
import type { EnrollmentId, HomeworkId, SectionId } from '@vidya/domain'

export interface HomeworkAnswerRecord {
  readonly version: LocalLessonVersion

  /** The place the answer is written against; homework belongs to one. */
  readonly enrollmentId: EnrollmentId

  readonly sectionId: SectionId

  /** The answer already written on this section, if the student has one. */
  readonly answer: LocalHomework | null

  readonly text: string
  readonly mintId: () => HomeworkId
}

/**
 * What a screen hands the writer when the student has written an answer.
 *
 * One section holds one answer: the id already written against it is kept, and
 * a new one is minted only where nothing has been written yet. A second id
 * would ask the server to hold two answers to one question, which the unique
 * index on the triple refuses and the journal then retries for ever.
 */
export const recordHomeworkAnswer = (input: HomeworkAnswerRecord): SaveHomeworkAnswer => ({
  id: input.answer?.id ?? input.mintId(),
  schoolId: input.version.schoolId,
  enrollmentId: input.enrollmentId,
  lessonVersionId: input.version.id,
  sectionId: input.sectionId,
  text: input.text,
})
