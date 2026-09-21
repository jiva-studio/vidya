import { FluentBundle } from '@fluent/bundle'
import type {
  BlockStateKey,
  HomeworkAnswerKey,
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IGroupRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
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
import { education } from '@vidya/client'
import type { SyncCollection, SyncRejectionReason } from '@vidya/domain'
import { isLive, isRecruiting } from '@vidya/domain'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createFluentVue } from 'fluent-vue'
import { type Component, ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'

import sharedResources from '@/shared/i18n'
import educationResources from '@/ui/education/i18n'
import type { SubmissionState } from '@/ui/sync'
import syncResources from '@/ui/sync/i18n'

import { routes } from '../routes'

export * from './localFixtures'

/**
 * A device with data on it, and the screens mounted against it.
 *
 * The screens are supposed to read from the device and from nowhere else, so
 * the doubles here are the device — arrays behind the data ports — and the
 * module double for `@/app` offers no HTTP client at all. A screen that reaches
 * for one fails loudly instead of quietly passing on a fake.
 */

/* -------------------------------------------------------------------------- */
/*                                  The device                                */
/* -------------------------------------------------------------------------- */

export interface LocalSeed {
  schools: LocalSchool[]
  courses: LocalCourse[]
  lessons: LocalLesson[]
  versions: LocalLessonVersion[]
  enrollments: LocalEnrollment[]
  groups: LocalGroup[]
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
  groups: IGroupRepository
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

/* -------------------------------------------------------------------------- */
/*                                Minted ids                                  */
/* -------------------------------------------------------------------------- */

/**
 * The ids the screens minted, in the order they were handed out.
 *
 * The app names its own rows, and the source of the names is installed by the
 * composition root — which these tests mount without. Installing a counted one
 * here does more than stop the throw: a row a tap produced can be named in an
 * assertion instead of being described as whichever one is new.
 */
export const mintedIds: string[] = []

const nextUuid = (): string => {
  const id = `00000000-0000-4000-8000-${String(mintedIds.length + 1).padStart(12, '0')}`
  mintedIds.push(id)

  return id
}

/** The id the next write will carry, before it is written. */
export const upcomingId = (): string =>
  `00000000-0000-4000-8000-${String(mintedIds.length + 1).padStart(12, '0')}`

/** The schools waiting for a new sign-in; empty unless a test strands one. */
export const awaitingSignIn = ref<readonly { baseUrl: string }[]>([])

/**
 * The double for `@/app`, and the whole of what a screen may ask it for.
 *
 * There is no transport here and no name under which one could be fetched: a
 * client belongs to a connection, and a screen holds no connection of its own.
 * What it may ask the registry is which of the student's schools have stopped
 * accepting their sign-in, because that is what it has to say on the screen.
 */
export const appDouble = {
  useRepositories: () => repositories,
  useSyncStatus: () => syncStatus,
  useOutboxView: () => outboxView,
  useConnections: () => ({ awaitingSignIn }),
  useMediaUrls: () => mediaUrls,
}

/* -------------------------------------------------------------------------- */
/*                             Playable addresses                             */
/* -------------------------------------------------------------------------- */

/** The addresses the school has issued, keyed by the path a block stores. */
export const mediaAddresses = new Map<string, string>()

/** Every batch a screen asked to have primed, newest last. */
export const primedBatches: string[][] = []

/**
 * The resolver as a screen uses it: priming needs the network, reading does not.
 *
 * An address is read while the element is being drawn, so `resolve` answers
 * from memory or answers nothing. `prime` fails with the radio off, which is
 * the case a lesson already on the device has to survive.
 */
export const mediaUrls = {
  prime: async (paths: readonly string[]): Promise<void> => {
    primedBatches.push([...paths])
    if (!online) throw new Error('the addresses could not be asked for')
  },
  resolve: (path: string): string | undefined =>
    path.startsWith('https://') ? path : mediaAddresses.get(path),
}

/** A controllable `@capacitor/network`, so a test can switch the radio off. */
const networkListeners: ((status: { connected: boolean }) => void)[] = []

let online = true

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
  online = connected
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

/**
 * Screens mounted and not yet taken down.
 *
 * A page left mounted is still listening. It watches the same `syncing` ref and
 * reads through the same repositories object as the page under test, so the run
 * one test stages starts reads inside the pages of every test before it — and
 * those reads answer late, into assertions about something else.
 */
const mounted: VueWrapper[] = []

export async function mountPage(
  component: Component,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/education/courses')
  await router.isReady()

  const wrapper = mount(component, {
    props,
    global: { plugins: [fluentPlugin(), router], provide: { navManager } },
  })
  mounted.push(wrapper)

  return wrapper
}

/** Lets the reads a screen starts on mount settle before it is inspected. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

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
    groups: [],
    homework: [],
    blockStates: [],
  }
}

/** Puts the device back to empty and rebuilds the ports over it. */
export function resetLocalScreens(): void {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  Object.assign(seed, emptySeed())
  outboxRows.clear()
  navigations.length = 0
  mintedIds.length = 0
  mediaAddresses.clear()
  primedBatches.length = 0
  education.useUuidSource(nextUuid)
  setOnline(true)
  syncStatus.syncing.value = false
  syncStatus.firstRunCompleted.value = true
  syncStatus.done.value = 0
  syncStatus.total.value = 0
  awaitingSignIn.value = []

  Object.assign(repositories, buildRepositories())
}

const notWritten = (): never => {
  throw new Error('this double reads only; give the screen a repository that writes')
}

/**
 * Enrolments the way the SQL repository hands them over, method by method.
 *
 * The three readers answer different questions. `list` hides what the student
 * put away, and only that. `getLiveByCourse` hides nothing and looks for the
 * row that still holds a place, newest first when two of them do. `getById`
 * filters nothing: a row asked for by name is the one case the screens exist
 * to explain.
 */
const byCreatedAt = (direction: 'asc' | 'desc'): LocalEnrollment[] =>
  seed.enrollments
    .filter((item) => item.deletedAt === null)
    .sort((a, b) =>
      direction === 'asc'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )

/** Hidden once the student put a finished row away. No instant is compared. */
const visibleToStudent = (row: LocalEnrollment) =>
  !(row.archivedByStudentAt !== null && !isLive(row.status))

/** The rows that still hold a place, newest first. */
const listLive = () => byCreatedAt('desc').filter((item) => isLive(item.status))

function buildRepositories(): LocalRepositories {
  return {
    schools: {
      // A fresh array per call, as a query is. Handing out the seed itself
      // would let a row pushed later appear inside an answer already given.
      list: async () => seed.schools.slice(),
      getById: async (id) => seed.schools.find((item) => item.id === id) ?? null,
    },

    courses: {
      list: async () => seed.courses.slice(),
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
      list: async () => byCreatedAt('asc').filter(visibleToStudent),
      getById: async (id) => seed.enrollments.find((item) => item.id === id) ?? null,
      getLiveByCourse: async (courseId) =>
        listLive().find((item) => item.courseId === courseId) ?? null,
      request: notWritten,
      withdraw: notWritten,
      archive: notWritten,
      unarchive: notWritten,
    },

    groups: {
      /**
       * The filter lives in the query, not in the component.
       *
       * Two screens read this list, and a predicate written into both of them
       * is two predicates that will one day disagree about which group is
       * still taking students.
       */
      listRecruitingByCourse: async (courseId) =>
        seed.groups.filter((item) => item.courseId === courseId && isRecruiting(item.status)),

      // Unfiltered on purpose: an accepted student's own group is shown
      // whatever its status, or the place they hold disappears the day
      // recruitment closes.
      getById: async (id) => seed.groups.find((item) => item.id === id) ?? null,
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
