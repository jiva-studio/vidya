import type {
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IGroupRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
} from '@vidya/client'

/**
 * What a screen may read of the school's material on this machine.
 *
 * `enrollments`, `homework` and `blockStates` are narrowed to their reads. The repositories
 * behind them also write, and a local write has to be journaled in the same
 * transaction that performs it or it is never sent to the server. The journal
 * belongs to the engine, which only the writing tab runs, so the writing half
 * is not offered here at all rather than offered unjournaled. A screen that
 * writes asks the writing tab for its journaled repositories instead.
 */
export interface LocalEducation {
  readonly courses: ICourseRepository
  readonly lessons: ILessonRepository
  readonly lessonVersions: ILessonVersionRepository
  readonly groups: IGroupRepository
  readonly enrollments: Pick<IEnrollmentRepository, 'list' | 'getById' | 'getLiveByCourse'>
  readonly homework: Pick<IHomeworkRepository, 'listByEnrollment'>
  readonly blockStates: Pick<IBlockStateRepository, 'listByLessonVersion'>
}
