import type { LocalCourse, LocalHomework, SubmissionState } from '@vidya/client'
import type {
  BlockId,
  EnrollmentStatus,
  LessonBlockState,
  LessonContent,
  LessonId,
  LessonSection,
  SectionId,
  SyncRejectionReason,
} from '@vidya/domain'
import type { LessonPreviewLabels, LessonProgress } from '@vidya/ui'
import type { LocalCourse, LocalEnrollment, LocalGroup } from '@vidya/client'
import type { EnrollmentStatus, GroupId, LessonId } from '@vidya/domain'

import type { OfferedHours } from './model/toOfferedHours'

/**
 * One lesson as the course screen lists it.
 *
 * `blocks` and `done` are counted from what this machine holds — the blocks of
 * the published version it has, and the states the student has written against
 * them. `held` is false while the version itself has not arrived, which is why
 * a lesson can be listed with nothing to count.
 */
export interface LessonRow {
  readonly id: LessonId
  readonly number: number
  readonly title: string
  readonly blocks: number
  readonly done: number
  readonly held: boolean
}

export interface CourseCardProps {
  course: LocalCourse

  /** The public code of the school the address is written under. */
  code: string
}

export interface LessonRowProps {
  row: LessonRow
  code: string
  courseId: string
}

export interface CoursePlaceProps {
  /** The place the student holds on this course, or null when they hold none. */
  status: EnrollmentStatus | null

  /** How far the request got towards the school; absent while none was written here. */
  submission?: SubmissionState

  /** Why the school refused it, on a request that was refused. */
  reason?: SyncRejectionReason
}

/**
 * One section's homework, as the lesson screen hangs it under that section.
 *
 * `answer` is null until the student has written one. `writable` is false in a
 * tab that does not hold the database, so the answer is shown and nothing is
 * offered that would be dropped. `submission` and `reason` are absent while
 * there is no answer on this machine to have a journey.
 */
export interface SectionHomeworkProps {
  section: LessonSection
  answer: LocalHomework | null
  writable: boolean
  submission?: SubmissionState
  reason?: SyncRejectionReason
}

export interface SectionHomeworkEmits {
  save: [text: string]
  hand: []
}

export interface LessonOutdatedEmits {
  reload: []
}

/**
 * The lesson itself, with the student's homework hung under each section.
 *
 * `answerable` is false for somebody who holds no place on the course: they
 * read the lesson and are offered no form, because there is nothing for an
 * answer of theirs to be written against.
 */
export interface LessonBodyProps {
  content: LessonContent
  labels: LessonPreviewLabels
  progress?: LessonProgress
  answers: Readonly<Partial<Record<SectionId, LocalHomework>>>
  answerable: boolean
  writable: boolean
}

export interface LessonBodyEmits {
  change: [blockId: BlockId, state: LessonBlockState]
  save: [section: LessonSection, text: string]
  hand: [section: LessonSection]
  /** Both addresses are written under the school's public code. */
  code: string
  courseId: string
}

/** The one thing a request offers to do with itself, given where it stands. */
export type PlaceActionName = 'withdraw' | 'archive' | 'unarchive'

/**
 * What a student asks for, as the form collects it.
 *
 * All three are wishes and none of them gates the others: the school reads
 * them and answers with a group of its own choosing, at hours of its own.
 * `times` names presets; the stretches behind them are the request's.
 */
export interface PlaceWish {
  readonly preferredGroupId: GroupId | null
  readonly times: readonly string[]
  readonly comment: string
}

export interface EnrollTimesProps {
  chosen: readonly string[]
}

export interface EnrollTimesEmits {
  'update:chosen': [chosen: readonly string[]]
}

export interface PlaceHoursProps {
  offers: readonly OfferedHours[]
}

export interface PlaceSummaryProps {
  place: LocalEnrollment

  /** The group the school put the student in, and the one they asked for. */
  group: LocalGroup | null
  preferredGroup: LocalGroup | null
}

export interface PlaceDispatchProps {
  place: LocalEnrollment
  busy: boolean
}

export interface PlaceDispatchEmits {
  act: [action: PlaceActionName]
}
