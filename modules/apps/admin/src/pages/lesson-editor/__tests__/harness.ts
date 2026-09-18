import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { routes } from '../routes'
import LessonEditorPage from '../ui/LessonEditorPage.vue'

// jsdom has no layout, so it implements neither of these, and reka's dialogs
// call both while moving focus. The same two lines as libs/ui's own setup.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

export const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
export const VERSIONS = '/edu/lessons/l1/versions'
export const LESSON_PATH = '/edu/lessons/l1'
export const EDITOR_PATH = '/courses/c1/lessons/l1/editor'
export const AWAY_PATH = '/courses/c1/lessons'

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
      { path: '/courses/:courseId/lessons', name: 'lessons', component: Away },
    ],
  })

  await router.push(EDITOR_PATH)
  await router.isReady()

  const wrapper = mountWithApp(Root, {
    global: { plugins: [router], provide: { [httpClientKey]: http.client } },
  })
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
