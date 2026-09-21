import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { mountWithApp, signInAs, STORY_SCHOOL } from '@/shared/testing'

import PageBack from '../PageBack.vue'

const blank = { template: '<div />' }

// The sections' own route tables live above `shared/`, so the placements they
// declare are mirrored here; the paths are what `pages/*/routes.ts` registers.
const index = (name: string, path: string): RouteRecordRaw => ({
  path,
  name,
  component: blank,
})

const under = (name: string, path: string, parent: string): RouteRecordRaw => ({
  path,
  name,
  component: blank,
  meta: { nav: { parent, label: `${name}-title` } },
})

const routes: RouteRecordRaw[] = [
  index('courses', '/s/:schoolId/courses'),
  index('groups', '/s/:schoolId/groups'),
  index('roles', '/s/:schoolId/roles'),
  index('schools', '/s/:schoolId/schools'),
  index('users', '/s/:schoolId/users'),
  index('homework-queue', '/s/:schoolId/homework'),
  under('course-create', '/s/:schoolId/courses/new', 'courses'),
  under('course-edit', '/s/:schoolId/courses/:courseId/edit', 'courses'),
  under('lessons', '/s/:schoolId/courses/:courseId/lessons', 'courses'),
  under('lesson-editor', '/s/:schoolId/courses/:courseId/lessons/:lessonId/editor', 'courses'),
  under('lesson-version', '/s/:schoolId/lessons/:lessonId/versions/:versionId', 'courses'),
  under('group-create', '/s/:schoolId/groups/new', 'groups'),
  under('group-edit', '/s/:schoolId/groups/:groupId/edit', 'groups'),
  under('group-members', '/s/:schoolId/groups/:groupId/members', 'groups'),
  under('role-new', '/s/:schoolId/roles/new', 'roles'),
  under('role-edit', '/s/:schoolId/roles/:id', 'roles'),
  under('school-new', '/s/:schoolId/schools/new', 'schools'),
  under('school-edit', '/s/:schoolId/schools/:id', 'schools'),
  under('school-settings', '/s/:schoolId/schools/:id/settings', 'schools'),
  under('user', '/s/:schoolId/users/:id', 'users'),
  under('homework-review', '/s/:schoolId/homework/:id', 'homework-queue'),
]

const placed = routes.filter((route) => route.meta?.nav)

const paramsOf = (path: string): Record<string, string> =>
  Object.fromEntries(
    [...path.matchAll(/:(\w+)/g)].map(([, key]) => [
      key,
      key === 'schoolId' ? STORY_SCHOOL : `${key}-1`,
    ]),
  )

const backFrom = (route: RouteRecordRaw): string => {
  const parent = (route.meta?.nav as { parent: string }).parent
  const target = routes.find((candidate) => candidate.name === parent)
  return (target?.path as string).replace(':schoolId', STORY_SCHOOL)
}

const openAt = async (route: RouteRecordRaw) => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  setAppRouter(router)
  await router.push({ name: route.name, params: paramsOf(route.path) })
  await router.isReady()

  const link = mountWithApp(PageBack, {
    global: { plugins: [router], stubs: { RouterLink: false } },
  })

  await flushPromises()
  return link
}

describe('PageBack', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
    addMessages({ en: '', ru: '' })
    signInAs([])
  })

  it.each(placed.map((route) => [String(route.name), route] as const))(
    'links back from %s to the screen it was reached through',
    async (_name, route) => {
      const link = await openAt(route)
      const anchor = link.find('a')

      expect(anchor.exists()).toBe(true)
      expect(anchor.attributes('href')).toBe(backFrom(route))
    },
  )

  it('shows nothing on a screen that stands on its own', async () => {
    const link = await openAt(routes[0])

    expect(link.find('a').exists()).toBe(false)
  })
})
