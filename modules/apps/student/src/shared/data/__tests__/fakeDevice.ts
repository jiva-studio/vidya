import type {
  ISchoolRepository,
  LocalBlockState,
  LocalCourse,
  LocalEnrollment,
  LocalGroup,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
  LocalSchool,
} from '@vidya/client'
import {
  asId,
  type BlockId,
  type CourseId,
  type EnrollmentId,
  type GroupId,
  type HomeworkId,
  isLive,
  isRecruiting,
  type LessonId,
  type LessonVersionId,
  type SchoolId,
  type SectionId,
  toIsoDateTime,
} from '@vidya/domain'
import { mount, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import type { Component, Ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { educationKey, type LocalEducation, schoolRepositoryKey } from '@/shared/data'
import { fluent } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'
import { type EnrollmentWrites, useDeviceWrites } from '@/shared/sync'

/**
 * Where the site stands, set outright.
 *
 * The status is one object for the whole tab and nothing puts it back, so a
 * suite that only ever moved it forward would make each test's answer depend
 * on the order the tests happen to run in.
 */
export const siteStandsAt = (at: { filled?: boolean; joined?: boolean } = {}): void => {
  const status = useSiteStatus()
  ;(status.firstRunCompleted as Ref<boolean>).value = at.filled ?? false
  ;(status.joined as Ref<boolean>).value = at.joined ?? false
}

/**
 * A device that holds exactly what a test puts on it.
 *
 * The screens are written against the ports and never against SQL, so a test
 * of a screen is a test about rows rather than about a database: what the
 * repositories answer here is what a finished synchronisation would have left.
 */
export interface DeviceRows {
  schools?: LocalSchool[]
  courses?: LocalCourse[]
  lessons?: LocalLesson[]
  versions?: LocalLessonVersion[]
  enrollments?: LocalEnrollment[]
  homework?: LocalHomework[]
  blockStates?: LocalBlockState[]
  groups?: LocalGroup[]
}

export const aSchool = (overrides: Partial<LocalSchool> = {}): LocalSchool => ({
  id: asId<SchoolId>('school-1'),
  name: 'Gita School',
  logoUrl: null,
  description: null,
  code: 'GITA',
  ...overrides,
})

export const aCourse = (overrides: Partial<LocalCourse> = {}): LocalCourse => ({
  id: asId<CourseId>('course-1'),
  schoolId: asId<SchoolId>('school-1'),
  name: 'Bhagavad Gita',
  description: null,
  learningType: 'individual',
  status: 'published',
  ...overrides,
})

export const aLesson = (overrides: Partial<LocalLesson> = {}): LocalLesson => ({
  id: asId<LessonId>('lesson-1'),
  schoolId: asId<SchoolId>('school-1'),
  courseId: asId<CourseId>('course-1'),
  lessonNumber: 1,
  title: 'The first lesson',
  ...overrides,
})

export const anEnrollment = (overrides: Partial<LocalEnrollment> = {}): LocalEnrollment => ({
  id: asId<EnrollmentId>('enrollment-1'),
  schoolId: asId<SchoolId>('school-1'),
  courseId: asId<CourseId>('course-1'),
  groupId: null,
  studentId: asId('student-1'),
  status: 'accepted',
  decidedById: null,
  decidedAt: null,
  createdAt: toIsoDateTime(new Date('2026-01-01T00:00:00.000Z')),
  deletedAt: null,
  preferredGroupId: null,
  preferredTimes: null,
  comment: null,
  archivedByStudentAt: null,
  ...overrides,
})

export const aGroup = (overrides: Partial<LocalGroup> = {}): LocalGroup => ({
  id: asId<GroupId>('group-1'),
  schoolId: asId<SchoolId>('school-1'),
  courseId: asId<CourseId>('course-1'),
  name: 'Tuesday evenings',
  description: null,
  startsAt: null,
  status: 'pending',
  ...overrides,
})

const aTextBlock = (id: string) => ({ id: asId<BlockId>(id), type: 'text' as const, content: '' })

export const aVersion = (overrides: Partial<LocalLessonVersion> = {}): LocalLessonVersion => ({
  id: asId<LessonVersionId>('version-1'),
  schoolId: asId<SchoolId>('school-1'),
  lessonId: asId<LessonId>('lesson-1'),
  version: 1,
  content: {
    schemaVersion: 1,
    sections: [
      {
        id: asId('section-1'),
        title: 'What is taught',
        assessment: 'none',
        blocks: [aTextBlock('block-1'), aTextBlock('block-2')],
      },
    ],
  },
  status: 'published',
  publishedAt: null,
  ...overrides,
})

export const aBlockState = (overrides: Partial<LocalBlockState> = {}): LocalBlockState => ({
  id: 'state-1',
  schoolId: asId<SchoolId>('school-1'),
  enrollmentId: asId<EnrollmentId>('enrollment-1'),
  lessonVersionId: asId<LessonVersionId>('version-1'),
  blockId: asId<BlockId>('block-1'),
  state: { type: 'text', read: true },
  verdict: null,
  updatedAt: toIsoDateTime(new Date('2026-01-02T00:00:00.000Z')),
  ...overrides,
})

export const anAnswer = (overrides: Partial<LocalHomework> = {}): LocalHomework => ({
  id: asId<HomeworkId>('homework-1'),
  schoolId: asId<SchoolId>('school-1'),
  enrollmentId: asId<EnrollmentId>('enrollment-1'),
  lessonVersionId: asId<LessonVersionId>('version-1'),
  sectionId: asId<SectionId>('section-1'),
  status: 'open',
  text: '',
  grade: null,
  comment: null,
  answeredSupersededVersion: false,
  reviewedById: null,
  submittedAt: null,
  reviewedAt: null,
  createdAt: toIsoDateTime(new Date('2026-01-03T00:00:00.000Z')),
  ...overrides,
})

const LIVE = ['pending', 'accepted']

export const fakeDevice = (rows: DeviceRows = {}) => {
  const schools = rows.schools ?? []
  const courses = rows.courses ?? []
  const lessons = rows.lessons ?? []
  const versions = rows.versions ?? []
  const enrollments = rows.enrollments ?? []
  const homework = rows.homework ?? []
  const blockStates = rows.blockStates ?? []
  const groups = rows.groups ?? []
  // Copied rather than held: the writes below amend this list, and a fixture
  // shared between tests would carry one test's withdrawal into the next.
  const schools = [...(rows.schools ?? [])]
  const courses = [...(rows.courses ?? [])]
  const lessons = [...(rows.lessons ?? [])]
  const versions = [...(rows.versions ?? [])]
  const enrollments = [...(rows.enrollments ?? [])]
  const blockStates = [...(rows.blockStates ?? [])]
  const groups = [...(rows.groups ?? [])]

  const schoolRepository: ISchoolRepository = {
    list: vi.fn(async () => schools),
    getById: vi.fn(async (id) => schools.find((school) => school.id === id) ?? null),
    getByCode: vi.fn(async (code) => schools.find((school) => school.code === code) ?? null),
  }

  const education: LocalEducation = {
    courses: {
      list: vi.fn(async () => courses),
      getById: vi.fn(async (id) => courses.find((course) => course.id === id) ?? null),
    },
    lessons: {
      listByCourse: vi.fn(async (courseId) =>
        lessons
          .filter((lesson) => lesson.courseId === courseId)
          .toSorted((one, other) => one.lessonNumber - other.lessonNumber),
      ),
      getById: vi.fn(async (id) => lessons.find((lesson) => lesson.id === id) ?? null),
    },
    lessonVersions: {
      getById: vi.fn(async (id) => versions.find((version) => version.id === id) ?? null),
      getPublished: vi.fn(
        async (lessonId) =>
          versions.find(
            (version) => version.lessonId === lessonId && version.status === 'published',
          ) ?? null,
      ),
    },
    groups: {
      listRecruitingByCourse: vi.fn(async (courseId) =>
        groups.filter((group) => group.courseId === courseId && isRecruiting(group.status)),
      ),
      getById: vi.fn(async (id) => groups.find((group) => group.id === id) ?? null),
    },
    enrollments: {
      // The device keeps a live place on the list whether or not it was put
      // away: only a finished request leaves it.
      list: vi.fn(async () =>
        enrollments.filter((place) => place.archivedByStudentAt === null || isLive(place.status)),
      ),
      getById: vi.fn(async (id) => enrollments.find((place) => place.id === id) ?? null),
      getLiveByCourse: vi.fn(
        async (courseId) =>
          enrollments.find((place) => place.courseId === courseId && LIVE.includes(place.status)) ??
          null,
      ),
    },
    homework: {
      listByEnrollment: vi.fn(async (enrollmentId) =>
        homework.filter((answer) => answer.enrollmentId === enrollmentId),
      ),
    },
    blockStates: {
      listByLessonVersion: vi.fn(async (enrollmentId, lessonVersionId) =>
        blockStates.filter(
          (state) =>
            state.enrollmentId === enrollmentId && state.lessonVersionId === lessonVersionId,
        ),
      ),
    },
  }

  const writes = fakeWrites(enrollments)

  return {
    schools: schoolRepository,
    education,
    enrollments,
    writes,
    provide: {
      [schoolRepositoryKey as symbol]: schoolRepository,
      [educationKey as symbol]: education,
    },
  }
}

const WRITTEN_AT = toIsoDateTime(new Date('2026-02-01T00:00:00.000Z'))

/**
 * The writing tab's half of the device.
 *
 * The rows land in the same list the readers answer from, because a screen
 * that asks for a place and then re-reads the course must find the place it
 * has just made — as it would on a machine that wrote it to SQLite.
 */
const fakeWrites = (enrollments: LocalEnrollment[]): EnrollmentWrites => {
  const amend = async (id: string, changes: Partial<LocalEnrollment>) => {
    const at = enrollments.findIndex((place) => place.id === id)
    if (at < 0) throw new Error(`no local enrollment with id ${id}`)

    const amended = { ...enrollments[at]!, ...changes }
    enrollments.splice(at, 1, amended)

    return amended
  }

  return {
    request: vi.fn(async (input) => {
      const written = anEnrollment({
        ...input,
        status: 'pending',
        createdAt: WRITTEN_AT,
        groupId: null,
        preferredGroupId: input.preferredGroupId ?? null,
        preferredTimes: input.preferredTimes ?? null,
        comment: input.comment ?? null,
      })
      enrollments.push(written)

      return written
    }),
    withdraw: vi.fn((id) => amend(id, { status: 'withdrawn' })),
    archive: vi.fn((id) => amend(id, { archivedByStudentAt: WRITTEN_AT })),
    unarchive: vi.fn((id) => amend(id, { archivedByStudentAt: null })),
  }
}

/** Makes this the tab that writes, so the screens are offered the writes above. */
export const letTheTabWrite = (writes: EnrollmentWrites | undefined): void => {
  useDeviceWrites().adoptEnrollments(writes)
}

/**
 * The rendered text, with the marks Fluent puts around an interpolated value
 * taken out: they are invisible on screen and in the way of an assertion.
 */
export const textOf = (screen: VueWrapper): string => screen.text().replace(/[\u2066-\u2069]/g, '')

/** The name of the route a screen has navigated to, after it has done so. */
export const addressOf = (screen: VueWrapper): string =>
  String((screen.vm as unknown as { $route: { name?: string } }).$route.name ?? '')

const blank = { template: '<div />' }

/**
 * The addresses a screen links against, spelled out here because a test may
 * not reach the composition root that gathers them. The sections' own tables
 * are held to these paths where they are declared.
 */
const addresses: RouteRecordRaw[] = [
  { path: '/', name: 'learning', component: blank },
  { path: '/s/:code', name: 'school', component: blank },
  { path: '/s/:code/c/:courseId', name: 'course', component: blank },
  { path: '/s/:code/c/:courseId/l/:lessonId', name: 'lesson', component: blank },
  { path: '/homework', name: 'homework', component: blank },
  { path: '/s/:code/c/:courseId/enroll', name: 'enroll', component: blank },
  { path: '/s/:code/c/:courseId/place', name: 'place', component: blank },
]

/** Mounts a screen at one address, with the site's own routes behind it. */
export const mountAt = async (
  screen: Component,
  path: string,
  provide: Record<symbol, unknown>,
): Promise<VueWrapper> => {
  const router = createRouter({ history: createMemoryHistory(), routes: addresses })
  await router.push(path)
  await router.isReady()

  return mount(screen, { global: { plugins: [fluent, router], provide } })
}
