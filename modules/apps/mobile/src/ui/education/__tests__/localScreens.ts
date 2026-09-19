import { FluentBundle } from '@fluent/bundle'
import type {
  BlockId,
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncCollection,
  SyncRejectionReason,
  UserId,
} from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createFluentVue } from 'fluent-vue'
import { type Component, ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'

import type {
  BlockStateKey,
  HomeworkAnswerKey,
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
  ISchoolRepository,
  LocalBlockState,
  LocalCourse,
  LocalEnrollment,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
  LocalSchool,
} from '@/ports'
import sharedResources from '@/shared/i18n'
import educationResources from '@/ui/education/i18n'
import type { SubmissionState } from '@/ui/sync'
import syncResources from '@/ui/sync/i18n'

import { routes } from '../routes'

/**
 * A device with data on it, and the screens mounted against it.
 *
 * The screens are supposed to read from the device and from nowhere else, so
 * the doubles here are the device — arrays behind the data ports — and the
 * module double for `@/app` offers no HTTP client at all. A screen that reaches
 * for one fails loudly instead of quietly passing on a fake.
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

/* -------------------------------------------------------------------------- */
/*                                  The device                                */
/* -------------------------------------------------------------------------- */

export interface LocalSeed {
  schools: LocalSchool[]
  courses: LocalCourse[]
  lessons: LocalLesson[]
  versions: LocalLessonVersion[]
  enrollments: LocalEnrollment[]
  homework: LocalHomework[]
  blockStates: LocalBlockState[]
}

/** The ports the screens read the device through, gathered for one lookup. */
export interface LocalRepositories {
  schools: ISchoolRepository
  courses: ICourseRepository
  lessons: ILessonRepository
  lessonVersions: ILessonVersionRepository
  enrollments: IEnrollmentRepository
  homework: IHomeworkRepository
  blockStates: IBlockStateRepository
}

export const seed: LocalSeed = emptySeed()

export const repositories = {} as LocalRepositories

/** What a run of the engine has told the screens so far. */
export const syncStatus = {
  syncing: ref(false),
  firstRunCompleted: ref(true),
  done: ref(0),
  total: ref(0),
}

/** The outbox as a screen asks about it: one state and one reason per document. */
export const outboxRows = new Map<
  string,
  { state: SubmissionState; reason?: SyncRejectionReason }
>()

export const outboxView = {
  state: (collection: SyncCollection, docId: string): SubmissionState =>
    outboxRows.get(`${collection}:${docId}`)?.state ?? 'accepted',
  reason: (collection: SyncCollection, docId: string): SyncRejectionReason | undefined =>
    outboxRows.get(`${collection}:${docId}`)?.reason,
}

/** Where a screen asked to navigate, newest last. */
export const navigations: RouteLocationRaw[] = []

/**
 * The double for `@/app`, and the whole of what a screen may ask it for.
 *
 * There is no transport here and no name under which one could be fetched: a
 * client belongs to a connection, and a screen holds no connection. A screen
 * that reaches for one finds nothing, which is the invariant rather than a gap
 * in the double.
 */
export const appDouble = {
  useRepositories: () => repositories,
  useSyncStatus: () => syncStatus,
  useOutboxView: () => outboxView,
}

/** A controllable `@capacitor/network`, so a test can switch the radio off. */
const networkListeners: ((status: { connected: boolean }) => void)[] = []

export const capacitorNetworkDouble = {
  Network: {
    addListener: (_event: string, listener: (status: { connected: boolean }) => void) => {
      networkListeners.push(listener)
      return { remove: () => undefined }
    },
    getStatus: () => Promise.resolve({ connected: true }),
  },
}

export function setOnline(connected: boolean): void {
  networkListeners.forEach((listener) => listener({ connected }))
}

/* -------------------------------------------------------------------------- */
/*                                  Mounting                                  */
/* -------------------------------------------------------------------------- */

/** Ionic reads navigation out of an injected manager rather than the router. */
const navManager = {
  canGoBack: () => false,
  goBack: () => undefined,
  goForward: () => undefined,
  handleNavigate: (location: RouteLocationRaw) => navigations.push(location),
}

function fluentPlugin() {
  const bundle = new FluentBundle('en', { useIsolating: false })
  for (const resources of [educationResources.en, syncResources.en, sharedResources.en]) {
    resources.forEach((resource) => bundle.addResource(resource))
  }

  return createFluentVue({ bundles: [bundle] })
}

export async function mountPage(
  component: Component,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/education/courses')
  await router.isReady()

  return mount(component, {
    props,
    global: { plugins: [fluentPlugin(), router], provide: { navManager } },
  })
}

/** Lets the reads a screen starts on mount settle before it is inspected. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

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
  deletedAt: null,
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

/* -------------------------------------------------------------------------- */
/*                                    Reset                                   */
/* -------------------------------------------------------------------------- */

function emptySeed(): LocalSeed {
  return {
    schools: [],
    courses: [],
    lessons: [],
    versions: [],
    enrollments: [],
    homework: [],
    blockStates: [],
  }
}

/** Puts the device back to empty and rebuilds the ports over it. */
export function resetLocalScreens(): void {
  Object.assign(seed, emptySeed())
  outboxRows.clear()
  navigations.length = 0
  setOnline(true)
  syncStatus.syncing.value = false
  syncStatus.firstRunCompleted.value = true
  syncStatus.done.value = 0
  syncStatus.total.value = 0

  Object.assign(repositories, buildRepositories())
}

const notWritten = (): never => {
  throw new Error('this double reads only; give the screen a repository that writes')
}

/**
 * Enrolments as the SQL repository hands them over: tombstones skipped, newest
 * first.
 *
 * A double that is more forgiving than the thing it stands in for tests the
 * double. A withdrawn request is invisible here for the same reason it is
 * invisible there, and `getByCourse` answers with the newest row for the same
 * reason too — which is precisely the ordering a second request would exploit.
 */
const liveEnrollments = (): LocalEnrollment[] =>
  seed.enrollments
    .filter((item) => item.deletedAt === null)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

function buildRepositories(): LocalRepositories {
  return {
    schools: {
      list: async () => seed.schools,
      getById: async (id) => seed.schools.find((item) => item.id === id) ?? null,
    },

    courses: {
      list: async () => seed.courses,
      getById: async (id) => seed.courses.find((item) => item.id === id) ?? null,
    },

    lessons: {
      listByCourse: async (courseId) => seed.lessons.filter((item) => item.courseId === courseId),
      getById: async (id) => seed.lessons.find((item) => item.id === id) ?? null,
    },

    lessonVersions: {
      getById: async (id) => seed.versions.find((item) => item.id === id) ?? null,
      getPublished: async (lessonId) =>
        seed.versions
          .filter((item) => item.lessonId === lessonId && item.status === 'published')
          .sort((a, b) => b.version - a.version)[0] ?? null,
    },

    enrollments: {
      list: async () => liveEnrollments(),
      getById: async (id) => liveEnrollments().find((item) => item.id === id) ?? null,
      getByCourse: async (courseId) =>
        liveEnrollments().find((item) => item.courseId === courseId) ?? null,
      request: notWritten,
      withdraw: notWritten,
    },

    homework: {
      getById: async (id) => seed.homework.find((item) => item.id === id) ?? null,
      getByAnswerKey: async (key: HomeworkAnswerKey) =>
        seed.homework.find(
          (item) =>
            item.enrollmentId === key.enrollmentId &&
            item.lessonVersionId === key.lessonVersionId &&
            item.sectionId === key.sectionId,
        ) ?? null,
      listByEnrollment: async (enrollmentId) =>
        seed.homework.filter((item) => item.enrollmentId === enrollmentId),
      saveAnswer: notWritten,
      submit: notWritten,
    },

    blockStates: {
      getByKey: async (key: BlockStateKey) =>
        seed.blockStates.find(
          (item) =>
            item.enrollmentId === key.enrollmentId &&
            item.lessonVersionId === key.lessonVersionId &&
            item.blockId === key.blockId,
        ) ?? null,
      listByLessonVersion: async (enrollmentId, lessonVersionId) =>
        seed.blockStates.filter(
          (item) => item.enrollmentId === enrollmentId && item.lessonVersionId === lessonVersionId,
        ),
      save: notWritten,
    },
  }
}

resetLocalScreens()
