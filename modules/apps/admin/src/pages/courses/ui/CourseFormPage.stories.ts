import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import CourseFormPage from './CourseFormPage.vue'

/**
 * The course form, in the states the screen itself can be in.
 *
 * "Без прав" is absent on purpose: the form is behind `courses:update`, and a
 * reader who may not have it never reaches the screen (AC-7).
 */
const COURSE = '/edu/courses/c1'

const FULL = ['courses:read', 'courses:create', 'courses:update'] as PermissionKey[]

const course = {
  id: 'c1',
  name: 'Санскрит с нуля',
  description: 'Алфавит, падежи и сандхи',
  learningType: 'sequential',
}

const edit = { route: { name: 'course-edit', params: { courseId: 'c1' } } }

const over = (answers: FakeAnswers) => () => ({
  components: { CourseFormPage },
  setup() {
    signInAs(FULL)
    return {}
  },
  provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
  template: '<div class="p-[--space-6]"><CourseFormPage /></div>',
})

const meta: Meta<typeof CourseFormPage> = { title: 'Edu/CourseForm', component: CourseFormPage }

export default meta
type Story = StoryObj<typeof CourseFormPage>

export const WithData: Story = {
  name: 'Данные',
  parameters: edit,
  render: over({ [COURSE]: course }),
}

export const Empty: Story = {
  name: 'Пусто',
  parameters: { route: { name: 'course-create' } },
  render: over({}),
}

export const Loading: Story = {
  name: 'Загрузка',
  parameters: edit,
  render: over({ [COURSE]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  parameters: edit,
  render: over({ [COURSE]: refusal(503, 'Курс сейчас не читается') }),
}
