import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { sectionRoutes } from '../sections'

/**
 * What the sections can only be checked for once they are one application:
 * that every screen is reachable, that the shell points at routes that exist,
 * and that nothing the composition root owns exists in two copies.
 */
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

// The sections the shell itself offers. Everything else is reached from a
// screen, a guard or a link that was printed somewhere.
const inTheShell = ['courses', 'learning', 'homework', 'settings']

const reachedFromElsewhere: Record<string, string> = {
  login: 'the guard, when there is no session',
  join: 'the link a school prints or sends',
  school: 'a course of that school, and the school page of the catalogue',
  course: 'a row of the school catalogue',
  lesson: 'a row of the course',
  enroll: 'the course, when the student holds no place on it',
  place: 'the course, when they do — and the form, once it has been sent',
  'not-found': 'an address no section owns, or a code that is not one',
}

describe('the site as one thing', () => {
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

  it('offers every section of the shell at a route that exists', () => {
    const shell = readFileSync(join(root, 'app', 'App.vue'), 'utf8')
    const addresses = [...shell.matchAll(/to: '([^']+)'/g)].map((match) => match[1])

    expect(addresses.map((address) => String(router.resolve(address).name))).toEqual(inTheShell)
  })

  it('leaves no route without either a link in the shell or a screen that leads to it', () => {
    const orphans = [...routeNames].filter(
      (name) => !inTheShell.includes(name) && !(name in reachedFromElsewhere),
    )

    expect(orphans).toEqual([])
  })

  it('installs the translations of every slice that carries them', () => {
    const sections = readFileSync(join(root, 'app', 'sections.ts'), 'utf8')
    const translated = readdirSync(join(root, 'features')).filter((slice) =>
      existsSync(join(root, 'features', slice, 'i18n')),
    )

    expect(translated.length).toBeGreaterThan(0)
    expect(translated.filter((slice) => !sections.includes(`/features/${slice}'`))).toEqual([])
  })

  it('has one place that builds a transport, one connection and one device id', () => {
    const declarations = (pattern: RegExp) =>
      readAll()
        .filter((file) => pattern.test(file.text))
        .map((file) => file.path.slice(root.length + 1))

    expect(declarations(/httpClientFor\(/)).toHaveLength(1)
    expect(declarations(/createSyncEngine\(/)).toHaveLength(1)
    expect(declarations(/implements IDeviceId\b/)).toHaveLength(1)
  })

  it('keeps the schema and the engine behind the election of a writing tab', () => {
    const main = readFileSync(join(root, 'app', 'main.ts'), 'utf8')
    const writing = main.slice(main.indexOf('async function startWriting'))

    expect(writing).toMatch(/migrateSite\(db\)/)
    expect(writing).toMatch(/syncWithConnection\(/)
    expect(writing).toMatch(/saveOnExit\(db\)/)
    expect(main).toMatch(/electWriter\(/)
    expect(main.indexOf('electWriter(')).toBeGreaterThan(
      main.indexOf('async function startWriting'),
    )
  })
})
