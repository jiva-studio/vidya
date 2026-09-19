import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'
import { RouterView } from 'vue-router'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'
import { LessonEditorView } from '@/widgets/lesson-editor'

const VERSIONS = '/edu/lessons/l1/versions'

const route = { route: { name: 'lesson-editor', params: { courseId: 'c1', lessonId: 'l1' } } }

const FULL = ['lessons:read', 'lessons:update', 'lessons:publish'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { RouterView },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><RouterView /></div>',
  })

const summary = (id: string, version: number, status: string) => ({
  id,
  lessonId: 'l1',
  version,
  status,
})

const sections = [
  {
    id: 's1',
    title: 'Alphabet',
    assessment: 'none',
    blocks: [
      { id: 'b1', type: 'text', content: '# Devanagari\n\nЧитаем **слева направо**.' },
      { id: 'b2', type: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=abc' },
    ],
  },
  {
    id: 's2',
    title: 'Сандхи',
    assessment: 'teacher',
    blocks: [
      { id: 'b3', type: 'text', content: 'Разберите три примера и пришлите разбор.' },
      {
        id: 'b4',
        type: 'quiz',
        question: 'Что меняется на стыке?',
        answers: ['Vowel', 'Согласная'],
        rightAnswer: 0,
      },
    ],
  },
]

const strange = [
  {
    id: 's1',
    title: 'Alphabet',
    assessment: 'none',
    blocks: [
      { id: 'b1', type: 'text', content: 'Читаем слева направо.' },
      { id: 'b9', type: 'flashcards', cards: [{ front: 'स', back: 'sa' }] },
    ],
  },
]

const details = (id: string, version: number, status: string, content: unknown) => ({
  ...summary(id, version, status),
  content,
})

const filled = { schemaVersion: 1, sections }
const blank = { schemaVersion: 1, sections: [] }
const unknown = { schemaVersion: 1, sections: strange }

const draft = {
  [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
  [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft', filled),
  [`PATCH ${VERSIONS}/v1`]: details('v1', 1, 'draft', filled),
}

const meta: Meta<typeof LessonEditorView> = {
  title: 'Admin/Teaching/Lesson editor',
  component: LessonEditorView,
}

export default meta
type Story = StoryObj<typeof LessonEditorView>

export const Draft: Story = { parameters: route, name: 'Draft', render: over(draft) }

export const Published: Story = {
  parameters: route,
  name: 'Published version',
  render: over({
    [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'published')] },
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published', filled),
  }),
}

export const Empty: Story = {
  parameters: route,
  name: 'Empty',
  render: over({
    [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft', blank),
  }),
}

export const UnknownBlock: Story = {
  parameters: route,
  name: 'Unknown block',
  render: over({
    [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft', unknown),
  }),
}

export const Loading: Story = {
  parameters: route,
  name: 'Loading',
  render: over({ [VERSIONS]: pending() }),
}

export const Failed: Story = {
  parameters: route,
  name: 'Error',
  render: over({ [VERSIONS]: refusal(500, 'Версии урока не читаются') }),
}

export const WithoutRights: Story = {
  parameters: route,
  name: 'No permission',
  render: over(draft, ['lessons:read', 'lessons:update'] as PermissionKey[]),
}
