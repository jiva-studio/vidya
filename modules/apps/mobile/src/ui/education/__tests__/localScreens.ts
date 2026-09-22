import { FluentBundle } from '@fluent/bundle'
import { education } from '@vidya/client'
import type { SyncCollection, SyncRejectionReason } from '@vidya/domain'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createFluentVue } from 'fluent-vue'
import { type Component, ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'

import sharedResources from '@/shared/i18n'
import educationResources from '@/ui/education/i18n'
import type { SubmissionState } from '@/ui/sync'
import syncResources from '@/ui/sync/i18n'

import { routes } from '../routes'
import { buildRepositories, emptySeed, repositories, seed } from './localDevice'
import { mediaUrls, resetMediaDoubles } from './localMedia'

export * from './localDevice'
export * from './localFixtures'
export * from './localMedia'

/**
 * The screens, mounted against a device with data on it.
 *
 * The device is `localDevice`, the school files are `localMedia`, and the module
 * double for `@/app` offers no transport at all: a screen that reaches for one
 * fails loudly instead of quietly passing on a fake.
 */

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

/** Puts the device back to empty and rebuilds the ports over it. */
export function resetLocalScreens(): void {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  Object.assign(seed, emptySeed())
  outboxRows.clear()
  navigations.length = 0
  mintedIds.length = 0
  education.useUuidSource(nextUuid)
  resetMediaDoubles()
  syncStatus.syncing.value = false
  syncStatus.firstRunCompleted.value = true
  syncStatus.done.value = 0
  syncStatus.total.value = 0
  awaitingSignIn.value = []

  Object.assign(repositories, buildRepositories())
}

resetLocalScreens()
