import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import LessonVersionPage from './LessonVersionPage.vue'

/**
 * One published version, read and never written.
 *
 * "Без прав" is absent on purpose: the screen is behind `lessons:read`, and a
 * reader without it never arrives (AC-7). There is nothing to hide within it.
 */
const VERSION = '/edu/lessons/l1/versions/v7'

const route = { route: { name: 'lesson-version', params: { lessonId: 'l1', versionId: 'v7' } } }

const content = {
  schemaVersion: 1,
  sections: [
    {
      id: 's1',
      title: 'Алфавит',
      assessment: 'none',
      blocks: [{ id: 'b1', type: 'text', content: '# Деванагари\n\nЧитаем **слева направо**.' }],
    },
  ],
}

const over = (answers: FakeAnswers) => () => ({
  components: { LessonVersionPage },
  setup() {
    signInAs(['lessons:read'])
    return {}
  },
  provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
  template: '<div class="p-[--space-6]"><LessonVersionPage /></div>',
})

const version = (over: Record<string, unknown> = {}) => ({
  id: 'v7',
  lessonId: 'l1',
  version: 1,
  status: 'published',
  content,
  ...over,
})

const meta: Meta<typeof LessonVersionPage> = {
  title: 'Edu/LessonVersion',
  component: LessonVersionPage,
}

export default meta
type Story = StoryObj<typeof LessonVersionPage>

export const WithData: Story = {
  name: 'Данные',
  parameters: route,
  render: over({ [VERSION]: version() }),
}

export const Empty: Story = {
  name: 'Пусто',
  parameters: route,
  render: over({ [VERSION]: version({ content: { schemaVersion: 1, sections: [] } }) }),
}

export const Loading: Story = {
  name: 'Загрузка',
  parameters: route,
  render: over({ [VERSION]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  parameters: route,
  render: over({ [VERSION]: refusal(503, 'Версия урока сейчас не читается') }),
}
