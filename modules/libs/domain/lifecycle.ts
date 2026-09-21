/**
 * Lifecycle states shared by the schema, the entities and the wire.
 *
 * Declared once here so a new state cannot be added to the database CHECK
 * constraint and forgotten on the wire, or the other way round.
 */

/** A lesson version is editable until it is published, and immutable after. */
export const LessonVersionStatuses = ['draft', 'published'] as const
export type LessonVersionStatus = (typeof LessonVersionStatuses)[number]

/**
 * Enrolment is moderated: a request is reviewed before it grants access.
 *
 * Three of the four outcomes end a request, and a student reads them as three
 * different things. `declined` is the school refusing the request on its
 * merits. `revoked` is the school taking a place back that it had already
 * given — losing the school role revokes every place and every open request it
 * carried. `withdrawn` is the student handing the place back themselves. Only
 * the last one is the student's own doing, so collapsing any two of them would
 * tell someone the school turned them away when nobody did.
 */
export const EnrollmentStatuses = [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'withdrawn',
] as const
export type EnrollmentStatus = (typeof EnrollmentStatuses)[number]

/** The states that still hold a place on the course — asked for, or granted. */
export const LiveEnrollmentStatuses = ['pending', 'accepted'] as const

export const isLive = (status: EnrollmentStatus): boolean =>
  (LiveEnrollmentStatuses as readonly string[]).includes(status)

/**
 * A course is prepared out of sight and then shown.
 *
 * Only a published course is drawn in a school's catalogue. Unpublishing does
 * not take a place away: the content a student already holds arrives through
 * the course scope, which an accepted place grants, not through publication.
 */
export const CourseStatuses = ['draft', 'published'] as const
export type CourseStatus = (typeof CourseStatuses)[number]

/** A group is created before it runs, runs, and then stops taking anyone new. */
export const GroupStatuses = ['pending', 'active', 'inactive'] as const
export type GroupStatus = (typeof GroupStatuses)[number]

/** The one state in which a group still takes students. */
export const RECRUITING_GROUP_STATUS: GroupStatus = 'pending'

export const isRecruiting = (status: GroupStatus): boolean => status === RECRUITING_GROUP_STATUS

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
