import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'
import { RouterView } from 'vue-router'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'
import { LessonEditorView } from '@/widgets/lesson-editor'

import { messages } from '../i18n'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const VERSIONS = '/edu/lessons/l1/versions'

const FULL = ['lessons:read', 'lessons:update', 'lessons:publish'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { RouterView },
    setup() {
      signInWith(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><RouterView /></div>',
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
    title: 'Алфавит',
    assessment: 'none',
    blocks: [
      { id: 'b1', type: 'text', content: '# Деванагари\n\nЧитаем **слева направо**.' },
      { id: 'b2', type: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=abc' },
    ],
  },
  {
    id: 's2',
    title: 'Сандхи',
    assessment: 'teacher',
    blocks: [
      {
        id: 'b3',
        type: 'quiz',
        question: 'Что меняется на стыке?',
        answers: ['Гласная', 'Согласная'],
        rightAnswer: 0,
      },
    ],
  },
]

const details = (id: string, version: number, status: string, content: unknown) => ({
  ...summary(id, version, status),
  content,
})

const filled = { schemaVersion: 1, sections }
const blank = { schemaVersion: 1, sections: [] }

const draft = {
  [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
  [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft', filled),
  [`PATCH ${VERSIONS}/v1`]: details('v1', 1, 'draft', filled),
}

const meta: Meta<typeof LessonEditorView> = {
  title: 'Edu/LessonEditor',
  component: LessonEditorView,
}

export default meta
type Story = StoryObj<typeof LessonEditorView>

export const Draft: Story = { name: 'Черновик', render: over(draft) }

export const Published: Story = {
  name: 'Опубликованная версия',
  render: over({
    [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'published')] },
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published', filled),
  }),
}

export const Empty: Story = {
  name: 'Пусто',
  render: over({
    [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft', blank),
  }),
}

export const Loading: Story = { name: 'Загрузка', render: over({ [VERSIONS]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [VERSIONS]: refusal(500, 'Версии урока не читаются') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(draft, ['lessons:read', 'lessons:update'] as PermissionKey[]),
}
