import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { sectionMenu, sectionRoutes } from '../sections'

/**
 * What five sections written at once can only be checked for once they are one
 * application: that every screen is reachable, that the sidebar and the router
 * agree, and that nothing exists in two copies.
 */
// `src/` of the application: every claim below is made about the source.
const root = join(import.meta.dirname, '../..')

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.(ts|vue)$/.test(entry)) out.push(path)
  }
  return out
}

const sources = sourceFiles(root).filter((path) => !path.includes('__tests__'))

const readAll = () => sources.map((path) => ({ path, text: readFileSync(path, 'utf8') }))

const router = createRouter({
  history: createMemoryHistory(),
  routes: sectionRoutes() as RouteRecordRaw[],
})

const routeNames = new Set(
  router
    .getRoutes()
    .map((route) => String(route.name ?? ''))
    .filter(Boolean),
)

const menuRoutes = new Set(sectionMenu().flatMap((group) => group.items.map((item) => item.route)))

// Screens the sidebar deliberately does not list, each with what leads to it.
const reachedFromAScreen: Record<string, string> = {
  login: 'the guard, when there is no session',
  root: 'an address with no school in it, which the guard sends to the first granted one',
  'course-create': 'the courses list',
  'course-edit': 'a row of the courses list',
  lessons: 'a row of the courses list',
  'lesson-editor': 'a row of the lessons list',
  'lesson-version': 'a piece of work answered against a replaced version',
  'group-create': 'the groups list',
  'group-edit': 'a row of the groups list',
  'group-members': 'a row of the groups list',
  'school-new': 'the schools list',
  'school-edit': 'a row of the schools list',
  'school-settings': 'a row of the schools list',
  'role-new': 'the roles list',
  'role-edit': 'a row of the roles list',
  user: 'a row of the people list',
  'homework-review': 'a link to one piece of work, or the queue itself',
  forbidden: 'the guard, when the school grants too little',
  'not-found': 'an address no section owns',
}

describe('the application as one thing', () => {
  it('registers a route for every screen in pages/', () => {
    const screens = readdirSync(join(root, 'pages')).flatMap((section) => {
      const ui = join(root, 'pages', section, 'ui')
      const routes = readFileSync(join(root, 'pages', section, 'routes.ts'), 'utf8')
      return readdirSync(ui)
        .filter((file) => file.endsWith('Page.vue'))
        .map((file) => ({ section, file, registered: routes.includes(file) }))
    })

    expect(screens.filter((screen) => !screen.registered)).toEqual([])
    expect(screens.length).toBeGreaterThan(0)
  })

  it('points every sidebar entry at a route that exists', () => {
    expect([...menuRoutes].filter((name) => !routeNames.has(name))).toEqual([])
  })

  it('leaves no route without either a sidebar entry or a screen that leads to it', () => {
    const orphans = [...routeNames].filter(
      (name) => !menuRoutes.has(name) && !(name in reachedFromAScreen),
    )

    expect(orphans).toEqual([])
  })

  it('has one implementation of the permission check, the transport and the reason', () => {
    const declarations = (pattern: RegExp) =>
      readAll()
        .filter((file) => pattern.test(file.text))
        .map((file) => file.path.slice(root.length + 1))

    expect(declarations(/export const useCan\b/)).toHaveLength(1)
    expect(declarations(/implements HttpClient\b/)).toHaveLength(1)
    expect(declarations(/export const reasonOf\b/)).toHaveLength(1)
  })

  // Lesson text is drawn by @vidya/ui, which keeps its own `v-html` beside the
  // call that sanitises it. Nothing here may open a second door to the same
  // markup and reach it without that call.
  it('writes no raw html of its own', () => {
    const withHtml = readAll().filter(
      (file) => file.path.endsWith('.vue') && file.text.includes('v-html'),
    )

    expect(withHtml).toEqual([])
  })
})
