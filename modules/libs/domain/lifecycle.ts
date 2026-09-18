/**
 * Lifecycle states shared by the schema, the entities and the wire.
 *
 * Declared once here so a new state cannot be added to the database CHECK
 * constraint and forgotten on the wire, or the other way round.
 */

/** A lesson version is editable until it is published, and immutable after. */
export const LessonVersionStatuses = ['draft', 'published'] as const
export type LessonVersionStatus = (typeof LessonVersionStatuses)[number]

/** Enrolment is moderated: a request is reviewed before it grants access. */
export const EnrollmentStatuses = ['pending', 'accepted', 'declined'] as const
export type EnrollmentStatus = (typeof EnrollmentStatuses)[number]

/**
 * Homework moves forward through review. The client may only ever request
 * `pending` by submitting; every other transition is the server's.
 */
export const HomeworkStatuses = ['open', 'pending', 'in_review', 'returned', 'accepted'] as const
export type HomeworkStatus = (typeof HomeworkStatuses)[number]

/** Transitions the server will accept, keyed by the state being left. */
export const HomeworkTransitions: Readonly<Record<HomeworkStatus, readonly HomeworkStatus[]>> =
  Object.freeze({
    open: ['pending'],
    pending: ['in_review', 'returned', 'accepted'],
    in_review: ['returned', 'accepted'],
    returned: ['pending'],
    accepted: [],
  })

export const canTransitionHomework = (from: HomeworkStatus, to: HomeworkStatus): boolean =>
  HomeworkTransitions[from].includes(to)

/** How a course is taken: alone at your own pace, or with a group. */
export const CourseLearningTypes = ['individual', 'group'] as const
export type CourseLearningType = (typeof CourseLearningTypes)[number]
