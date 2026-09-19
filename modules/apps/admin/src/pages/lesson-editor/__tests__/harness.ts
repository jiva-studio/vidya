import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import type { MediaGateway } from '@/entities/media'
import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { httpClientKey, resetApi } from '@/shared/api'
import { manualClock } from '@/shared/lib'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { routes } from '../routes'
import LessonEditorPage from '../ui/LessonEditorPage.vue'

export const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
export const VERSIONS = '/edu/lessons/l1/versions'
export const LESSON_PATH = '/edu/lessons/l1'
export const EDITOR_PATH = `/s/${SCHOOL}/courses/c1/lessons/l1/editor`
export const AWAY_PATH = `/s/${SCHOOL}/courses/c1/lessons`

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

export const signIn = (granted: string[]) =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL, p: granted }]),
    refreshToken: 'refresh',
  })

// Two placeholders, declared as plain options objects: the editor is the only
// component this file is about.
const Away = { name: 'AwayHarness', render: () => h('div') }

const Root = defineComponent({ name: 'RootHarness', setup: () => () => h(RouterView) })

const mounted: { unmount: () => void }[] = []

// An attached mount stays in the document until it is unmounted, and a leaked
// one keeps answering `document.activeElement` in whatever test runs next.
afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.unmount()
})

const editorRoutes: RouteRecordRaw[] = routes.map((route) => ({
  path: route.path,
  name: route.name,
  component: LessonEditorPage,
}))

/**
 * The editor, mounted where it really lives: inside a matched route.
 *
 * The unsaved-changes guard is a route guard, so a test that mounted the widget
 * on its own would be testing a component with that guard switched off.
 */
export const openEditor = async (
  answers: Record<string, unknown>,
  granted: string[] = ['lessons:read', 'lessons:update', 'lessons:publish'],
  gateway?: MediaGateway,
) => {
  resetApi()
  signIn(granted)

  const http = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    // The section's own route records, so the test proves the contract the
    // lessons list links against: the name `lesson-editor` and its two
    // parameters. Only the lazy component is swapped for the eager one — a
    // dynamic import inside the first navigation is a timeout, not a test.
    routes: [
      ...editorRoutes,
      { path: '/s/:schoolId/courses/:courseId/lessons', name: 'lessons', component: Away },
    ],
  })

  await router.push(EDITOR_PATH)
  await router.isReady()

  // Every editor test can reach a media block now that one can be inserted from
  // the menu, and an unprovided gateway throws by design. A test that cares what
  // storage does brings its own; the rest get one that does nothing on its own.
  const media = gateway ?? new FakeMediaGateway({ clock: manualClock() })

  const wrapper = mountWithApp(Root, {
    // jsdom only moves focus inside a document, and Vue Test Utils only puts its
    // container there when it is told where to. Without this every assertion
    // about where the caret went reads `body` whatever the editor did.
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { [httpClientKey]: http.client, [mediaGatewayKey]: media },
    },
  })
  mounted.push(wrapper)
  await flushPromises()

  return { wrapper, http, router }
}

/** Clicks the button whose visible label is exactly this text. */
export const clickText = async (
  wrapper: {
    findAll: (
      selector: string,
    ) => { text: () => string; trigger: (e: string) => Promise<unknown> }[]
  },
  label: string,
): Promise<void> => {
  const button = wrapper.findAll('button').find((node) => plain(node.text()) === label)
  if (!button) throw new Error(`no button labelled "${label}"`)
  await button.trigger('click')
  await flushPromises()
}

export const labels = (wrapper: { findAll: (selector: string) => { text: () => string }[] }) =>
  wrapper.findAll('button').map((node) => plain(node.text()))

// Fluent wraps every placeable in bidi isolation marks, which are invisible on
// screen and in the way of a string comparison.
export const plain = (text: string) => text.replaceAll('⁨', '').replaceAll('⁩', '')

/* -------------------------------------------------------------------------- */
/*                          Reaching what is on screen                        */
/* -------------------------------------------------------------------------- */

/** What a screen reader would call this element: its label, or the text in it. */
export const accessibleName = (node: Element): string =>
  plain(node.getAttribute('aria-label') ?? node.textContent ?? '').trim()

/** Every control a menu, a dialog or a popover put outside the mounted tree. */
export const overlayControls = (): HTMLElement[] => [
  ...document.body.querySelectorAll<HTMLElement>(
    'button, [role="option"], [role="menuitem"], [role="tab"]',
  ),
]

export const overlayControl = (label: string): HTMLElement | undefined =>
  overlayControls().find((node) => accessibleName(node) === label)

/** Clicks a control an overlay opened, wherever in the body it was rendered. */
export const clickOverlay = async (label: string): Promise<void> => {
  const control = overlayControl(label)
  if (!control) {
    throw new Error(
      `no control labelled "${label}"; the body offers ${overlayControls()
        .map(accessibleName)
        .join(', ')}`,
    )
  }

  control.click()
  await flushPromises()
}
