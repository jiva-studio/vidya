import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * AC-34, checked rather than remembered: every screen has its states in
 * Storybook, so the admin can be read without a stand.
 */
const pages = join(import.meta.dirname, '../../pages')

/** The states every screen is shown in, and what may legitimately be missing. */
const required = ['Данные', 'Пусто', 'Загрузка', 'Ошибка', 'Без прав']

// A form is behind the permission that opens it, so there is no "Без прав" of
// it to draw; a screen with nothing to read has no "Пусто" either.
const exempt: Record<string, string[]> = {
  'CourseFormPage.vue': ['Без прав'],
  'GroupFormPage.vue': ['Без прав'],
  'LessonVersionPage.vue': ['Без прав'],
  'LoginPage.vue': ['Без прав', 'Пусто'],
  'DashboardPage.vue': ['Без прав', 'Пусто', 'Загрузка', 'Ошибка'],
}

// Two screens the sections do not own: they say one thing and say it always.
const withoutStories = ['ForbiddenPage.vue', 'NotFoundPage.vue']

// The editor is shown as the two things it can be — a draft and a published
// version — rather than as "Данные", which would say less about either.
const namedDifferently: Record<string, { file: string; data: string }> = {
  'LessonEditorPage.vue': { file: 'LessonEditor.stories.ts', data: 'Черновик' },
}

const screens = readdirSync(pages).flatMap((section) => {
  const ui = join(pages, section, 'ui')
  return readdirSync(ui)
    .filter((file) => file.endsWith('Page.vue') && !withoutStories.includes(file))
    .map((file) => ({ file, ui }))
})

const storyOf = ({ file, ui }: { file: string; ui: string }) => {
  const named = namedDifferently[file]
  const path = join(ui, named?.file ?? file.replace('.vue', '.stories.ts'))
  return { path, exists: existsSync(path), data: named?.data ?? 'Данные' }
}

describe('every screen in Storybook', () => {
  it('has a story file beside it', () => {
    const missing = screens.filter((screen) => !storyOf(screen).exists).map((s) => s.file)

    expect(missing).toEqual([])
    expect(screens.length).toBeGreaterThan(10)
  })

  it('shows each of its states', () => {
    const gaps = screens.flatMap((screen) => {
      const story = storyOf(screen)
      if (!story.exists) return []

      const text = readFileSync(story.path, 'utf8')
      const wanted = required
        .filter((state) => !(exempt[screen.file] ?? []).includes(state))
        .map((state) => (state === 'Данные' ? story.data : state))

      return wanted
        .filter((state) => !text.includes(`'${state}'`))
        .map((s) => `${screen.file}: ${s}`)
    })

    expect(gaps).toEqual([])
  })
})
