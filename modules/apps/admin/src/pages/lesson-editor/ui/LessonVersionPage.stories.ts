import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import LessonVersionPage from './LessonVersionPage.vue'

/**
 * One published version, read and never written.
 *
 * "No permission" is absent on purpose: the screen is behind `lessons:read`, and a
 * reader without it never arrives. There is nothing to hide within it.
 */
const VERSION = '/edu/lessons/l1/versions/v7'

const route = { route: { name: 'lesson-version', params: { lessonId: 'l1', versionId: 'v7' } } }

const content = {
  schemaVersion: 1,
  sections: [
    {
      id: 's1',
      title: 'Alphabet',
      assessment: 'none',
      blocks: [{ id: 'b1', type: 'text', content: '# Devanagari\n\nRead it **left to right**.' }],
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
  template: '<div class="p-[var(--space-6)]"><LessonVersionPage /></div>',
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
  title: 'Admin/Teaching/Lesson version',
  component: LessonVersionPage,
}

export default meta
type Story = StoryObj<typeof LessonVersionPage>

export const Default: Story = {
  parameters: route,
  render: over({ [VERSION]: version() }),
}

export const Loading: Story = {
  name: 'Loading',
  parameters: route,
  render: over({ [VERSION]: pending() }),
}

export const Empty: Story = {
  name: 'Empty',
  parameters: route,
  render: over({ [VERSION]: version({ content: { schemaVersion: 1, sections: [] } }) }),
}

export const Failed: Story = {
  name: 'Failed',
  parameters: route,
  render: over({ [VERSION]: refusal(503, 'Lesson storage is unavailable') }),
}
