// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

/**
 * The composition root, from the outside.
 *
 * The device database is opened and migrated **before** the first screen is
 * mounted, because every screen now reads from it: a list rendered against a
 * schema that is still being created is not empty for a moment, it is empty
 * and wrong, and the student cannot tell the difference from "you are not
 * enrolled in anything".
 *
 * A migration that fails is the one case where there is nothing to show. It
 * gets a screen saying so rather than the app with no data behind it.
 */

const events = vi.hoisted(() => [] as string[])
const state = vi.hoisted(() => ({ migrationFails: false }))

vi.mock('@/infra/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/persistence')>()
  const opened = { images: new Map() }

  const open = () => {
    events.push('open')
    return actual.useSqlJsPersistence(opened)
  }

  return {
    ...actual,
    useCapacitorSqlPersistence: open,
    useSqlJsPersistence: open,
    runMigrations: async (...args: Parameters<typeof actual.runMigrations>) => {
      events.push('migrate')
      if (state.migrationFails) throw new Error('the device schema could not be created')
      return actual.runMigrations(...args)
    },
  }
})

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: () => Promise.resolve({ value: null }),
    set: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  },
}))

vi.mock('@ionic/vue', () => ({ IonicVue: { install: () => undefined } }))

vi.mock('../router', () => ({
  default: { install: () => undefined, isReady: () => Promise.resolve() },
}))

vi.mock('../i18n', () => ({ fluent: { install: () => undefined } }))

vi.mock('../App.vue', () => ({
  default: {
    setup() {
      events.push('mount')
      return () => h('div', 'the student app')
    },
  },
}))

const root = () => document.querySelector('#app')!

describe('starting the app', () => {
  beforeEach(() => {
    events.length = 0
    state.migrationFails = false
    document.body.innerHTML = '<div id="app"></div>'
    vi.resetModules()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('opens and migrates the device database before the first screen', async () => {
    await import('../main')
    await vi.waitFor(() => expect(root().textContent).not.toBe(''))

    expect(events).toEqual(['open', 'migrate', 'mount'])
  })

  it('a migration that fails gets a screen of its own, not an empty app', async () => {
    state.migrationFails = true

    await import('../main')
    await vi.waitFor(() => expect(root().textContent).not.toBe(''))

    expect(events).not.toContain('mount')
    expect(root().textContent).not.toBe('the student app')
  })
})
