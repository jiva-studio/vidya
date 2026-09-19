import type {
  BlockId,
  CourseId,
  CourseLearningType,
  EnrollmentId,
  EnrollmentStatus,
  HomeworkId,
  HomeworkStatus,
  IsoDateTime,
  LessonContent,
  LessonId,
  LessonVersionId,
  LessonVersionStatus,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'

/**
 * What the screens read from the device, and what they are allowed to write.
 *
 * These are the app's ports, not the domain's: they describe local storage, and
 * local storage is a decision of this application. The sync ports in
 * `@vidya/domain/ports` are the other half — they describe the engine's needs
 * and both sides of the wire see them.
 *
 * Reading is offline by construction: every method here answers from SQLite and
 * never from the network. Writing is local too — an answer is saved the moment
 * the student taps save, and whether the server accepts it is a later question.
 *
 * The three writable repositories are wrapped by the journal decorator, which
 * appends the matching outbox row inside the same transaction. That is why the
 * mutating methods return the saved entity rather than `void`: the decorator
 * journals what was actually stored, not what the caller asked for.
 *
 * **Referential integrity is a property of the data here, not a constraint.** A
 * lookup may legitimately find homework whose lesson version has not arrived
 * yet, because the two ride scopes that advance independently. Every reader
 * returns `null` for the missing parent and the screens show a placeholder;
 * nothing throws and nothing is repaired.
 */

/* -------------------------------------------------------------------------- */
/*                                  Entities                                  */
/* -------------------------------------------------------------------------- */

export interface LocalSchool {
  readonly id: SchoolId
  readonly name: string

  /** External link; the bytes are never stored, so offline a card shows the initial. */
  readonly logoUrl: string | null

  readonly description: string | null
}

export interface LocalCourse {
  readonly id: CourseId
  readonly schoolId: SchoolId
  readonly name: string
  readonly description: string | null
  readonly learningType: CourseLearningType
}

export interface LocalLesson {
  readonly id: LessonId
  readonly schoolId: SchoolId
  readonly courseId: CourseId
  readonly lessonNumber: number
  readonly title: string
}

export interface LocalLessonVersion {
  readonly id: LessonVersionId
  readonly schoolId: SchoolId
  readonly lessonId: LessonId
  readonly version: number

  /**
   * The published lesson, whole. Stored exactly as it arrived, including a
   * `schemaVersion` this build has never heard of — the screen
   * offers an update rather than rendering half a lesson, and nothing is
   * thrown away in the meantime.
   */
  readonly content: LessonContent
  readonly status: LessonVersionStatus
  readonly publishedAt: IsoDateTime | null
}

export interface LocalEnrollment {
  readonly id: EnrollmentId
  readonly schoolId: SchoolId
  readonly courseId: CourseId
  readonly groupId: string | null
  readonly studentId: UserId
  readonly status: EnrollmentStatus
  readonly decidedById: UserId | null
  readonly decidedAt: IsoDateTime | null
  readonly createdAt: IsoDateTime

  /** Set when the enrolment was withdrawn. The downloaded course stays. */
  readonly deletedAt: IsoDateTime | null
}

export interface LocalHomework {
  readonly id: HomeworkId
  readonly schoolId: SchoolId
  readonly enrollmentId: EnrollmentId
  readonly lessonVersionId: LessonVersionId
  readonly sectionId: SectionId
  readonly status: HomeworkStatus
  readonly text: string
  readonly grade: number | null
  readonly answeredSupersededVersion: boolean
  readonly reviewedById: UserId | null
  readonly submittedAt: IsoDateTime | null
  readonly reviewedAt: IsoDateTime | null

  /** When the server recorded the answer. The list of answers is ordered by it. */
  readonly createdAt: IsoDateTime
}

export interface LocalBlockState {
  readonly id: string
  readonly schoolId: SchoolId
  readonly enrollmentId: EnrollmentId
  readonly lessonVersionId: LessonVersionId
  readonly blockId: BlockId

  /** Whatever the block type stores — a watched position, a quiz answer. */
  readonly state: Record<string, unknown>
  readonly updatedAt: IsoDateTime
}

/** Addresses one answer: the triple the unique index is built on. */
export interface HomeworkAnswerKey {
  readonly enrollmentId: EnrollmentId
  readonly lessonVersionId: LessonVersionId
  readonly sectionId: SectionId
}

/** Addresses one block's state. */
export interface BlockStateKey {
  readonly enrollmentId: EnrollmentId
  readonly lessonVersionId: LessonVersionId
  readonly blockId: BlockId
}

/* -------------------------------------------------------------------------- */
/*                              Read-only content                             */
/* -------------------------------------------------------------------------- */

export interface ISchoolRepository {
  list(): Promise<readonly LocalSchool[]>
  getById(id: SchoolId): Promise<LocalSchool | null>
}

export interface ICourseRepository {
  list(): Promise<readonly LocalCourse[]>
  getById(id: CourseId): Promise<LocalCourse | null>
}

export interface ILessonRepository {
  listByCourse(courseId: CourseId): Promise<readonly LocalLesson[]>
  getById(id: LessonId): Promise<LocalLesson | null>
}

export interface ILessonVersionRepository {
  getById(id: LessonVersionId): Promise<LocalLessonVersion | null>

  /** The highest published version of a lesson held locally, or `null`. */
  getPublished(lessonId: LessonId): Promise<LocalLessonVersion | null>
}

/* -------------------------------------------------------------------------- */
/*                            The student's own rows                          */
/* -------------------------------------------------------------------------- */

export interface NewEnrollmentRequest {
  readonly id: EnrollmentId
  readonly schoolId: SchoolId
  readonly courseId: CourseId
  readonly studentId: UserId
}

export interface IEnrollmentRepository {
  list(): Promise<readonly LocalEnrollment[]>
  getById(id: EnrollmentId): Promise<LocalEnrollment | null>
  getByCourse(courseId: CourseId): Promise<LocalEnrollment | null>

  /** Ask to join a course. Local and immediate; the school answers later. */
  request(input: NewEnrollmentRequest): Promise<LocalEnrollment>

  /** Withdraw the request. Journaled as a tombstone; downloads are kept. */
  withdraw(id: EnrollmentId): Promise<LocalEnrollment>
}

export interface SaveHomeworkAnswer extends HomeworkAnswerKey {
  readonly id: HomeworkId
  readonly schoolId: SchoolId
  readonly text: string
}

export interface IHomeworkRepository {
  getById(id: HomeworkId): Promise<LocalHomework | null>
  getByAnswerKey(key: HomeworkAnswerKey): Promise<LocalHomework | null>
  listByEnrollment(enrollmentId: EnrollmentId): Promise<readonly LocalHomework[]>

  /**
   * Save the answer's text.
   *
   * Refuses with {@link HomeworkFrozenError} unless the answer is `open` or
   * `returned`. The rule lives here, on the device, and not only
   * on the server: without it an offline edit after submission would journal a
   * row the server is bound to refuse, and the student would be told off for
   * something the app should never have offered.
   */
  saveAnswer(input: SaveHomeworkAnswer): Promise<LocalHomework>

  /** Hand the answer in. Same freeze rule, same refusal. */
  submit(id: HomeworkId, at: IsoDateTime): Promise<LocalHomework>
}

export interface SaveBlockState extends BlockStateKey {
  readonly id: string
  readonly schoolId: SchoolId
  readonly state: Record<string, unknown>
}

export interface IBlockStateRepository {
  getByKey(key: BlockStateKey): Promise<LocalBlockState | null>
  listByLessonVersion(
    enrollmentId: EnrollmentId,
    lessonVersionId: LessonVersionId,
  ): Promise<readonly LocalBlockState[]>
  save(input: SaveBlockState): Promise<LocalBlockState>
}

/* -------------------------------------------------------------------------- */
/*                                  Failures                                  */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when an answer is edited after it left the device.
 *
 * Carries the status that froze it, because the screen says different things
 * for `pending`, `in_review` and `accepted` — and because a caller that cannot
 * name the reason ends up showing "something went wrong".
 */
export class HomeworkFrozenError extends Error {
  readonly status: HomeworkStatus

  constructor(status: HomeworkStatus) {
    super(`homework is frozen for editing while its status is ${status}`)
    this.name = 'HomeworkFrozenError'
    this.status = status
  }
}

/** The two states in which an answer may still be edited. */
export const EDITABLE_HOMEWORK_STATUSES: readonly HomeworkStatus[] = ['open', 'returned']

export const isHomeworkEditable = (status: HomeworkStatus): boolean =>
  EDITABLE_HOMEWORK_STATUSES.includes(status)

/** Thrown when a mutating call names a row this identity does not hold. */
export class LocalRowNotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(`no local ${collection} row with id ${id}`)
    this.name = 'LocalRowNotFoundError'
  }
}
