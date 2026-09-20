import type {
  BlockId,
  CourseId,
  EnrollmentId,
  GroupId,
  HomeworkId,
  LessonId,
  LessonVersionId,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'

import type {
  LocalCourse,
  LocalEnrollment,
  LocalGroup,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
  LocalSchool,
} from '@/ports'

/**
 * The rows a screen test seeds the device with, and the identities they use.
 *
 * Kept beside the device double rather than inside it: every screen test names
 * these, and only some of them mount anything.
 */

/* -------------------------------------------------------------------------- */
/*                                 Identities                                 */
/* -------------------------------------------------------------------------- */

export const OWNER_ID = asId<UserId>('7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73')
export const SCHOOL_ID = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
export const COURSE_ID = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
export const LESSON_ID = asId<LessonId>('2f8c1a45-6b90-4d3e-a172-9c5b0e4d7183')
export const VERSION_ID = asId<LessonVersionId>('9d1e7b02-4c65-4f88-b3a7-1e6d2c9a0f47')
export const ENROLLMENT_ID = asId<EnrollmentId>('4a7e2c96-0d13-4b58-9f26-3c8b1a5e70d4')
export const SECTION_ID = asId<SectionId>('8e0b3d17-5a92-4c46-bf81-72d4e6c09a35')
export const HOMEWORK_ID = asId<HomeworkId>('1c5f9a83-2e47-4d60-8b39-06a7d2e14f58')
export const GROUP_ID = asId<GroupId>('d3f8a1b6-5e29-4c07-b84d-6a1f0e7c2953')
/* -------------------------------------------------------------------------- */
/*                                   Fixtures                                 */
/* -------------------------------------------------------------------------- */

export const aSchool = (overrides: Partial<LocalSchool> = {}): LocalSchool => ({
  id: SCHOOL_ID,
  name: 'School of Devotion',
  logoUrl: 'https://cdn.example.org/logos/devotion.png',
  description: 'Scripture, kirtan and practice.',
  ...overrides,
})

export const aCourse = (overrides: Partial<LocalCourse> = {}): LocalCourse => ({
  id: COURSE_ID,
  schoolId: SCHOOL_ID,
  name: 'Sanskrit for beginners',
  description: 'The alphabet, sandhi and the first verses.',
  learningType: 'individual',
  ...overrides,
})

export const aLesson = (overrides: Partial<LocalLesson> = {}): LocalLesson => ({
  id: LESSON_ID,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  lessonNumber: 1,
  title: 'The alphabet',
  ...overrides,
})

export const aLessonVersion = (
  overrides: Partial<LocalLessonVersion> = {},
): LocalLessonVersion => ({
  id: VERSION_ID,
  schoolId: SCHOOL_ID,
  lessonId: LESSON_ID,
  version: 1,
  status: 'published',
  publishedAt: parseIsoDateTime('2026-09-18T07:20:00.000Z'),
  content: {
    schemaVersion: 1,
    sections: [
      {
        id: SECTION_ID,
        title: 'Letters',
        assessment: 'teacher',
        blocks: [{ id: asId<BlockId>('blk-1'), type: 'text', content: 'The vowels come first.' }],
      },
    ],
  },
  ...overrides,
})

export const anEnrollment = (overrides: Partial<LocalEnrollment> = {}): LocalEnrollment => ({
  id: ENROLLMENT_ID,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  groupId: null,
  studentId: OWNER_ID,
  status: 'accepted',
  decidedById: null,
  decidedAt: null,
  createdAt: parseIsoDateTime('2026-09-18T07:20:00.000Z'),
  preferredGroupId: null,
  preferredTimes: null,
  comment: null,
  archivedByStudentAt: null,
  deletedAt: null,
  ...overrides,
})

/**
 * One group of a course, as the device holds it.
 *
 * Recruiting by default, because that is the state every enrolment screen is
 * about: a group still taking students. A closed one is `status: 'active'` with
 * the instant recruitment closed on it — the date records the fact, the status
 * decides (decision 14).
 */
export const aGroup = (overrides: Partial<LocalGroup> = {}): LocalGroup => ({
  id: GROUP_ID,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  name: 'Tuesday evenings',
  description: 'Two hours a week, online.',
  startsAt: null,
  status: 'pending',
  ...overrides,
})

export const aHomework = (overrides: Partial<LocalHomework> = {}): LocalHomework => ({
  id: HOMEWORK_ID,
  schoolId: SCHOOL_ID,
  enrollmentId: ENROLLMENT_ID,
  lessonVersionId: VERSION_ID,
  sectionId: SECTION_ID,
  status: 'pending',
  text: 'The vowels are a, aa, i.',
  grade: null,
  answeredSupersededVersion: false,
  reviewedById: null,
  submittedAt: parseIsoDateTime('2026-09-18T08:00:00.000Z'),
  reviewedAt: null,
  createdAt: parseIsoDateTime('2026-09-18T07:59:00.000Z'),
  ...overrides,
})
