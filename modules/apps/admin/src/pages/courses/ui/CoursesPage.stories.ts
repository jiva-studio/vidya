import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import CoursesPage from './CoursesPage.vue'

/**
 * The courses of the current school, in the five states every list has.
 *
 * Mounted whole over the fake transport, so what is shown is what the screen
 * makes of an answer rather than what a caller chose to pass it.
 */
const COURSES = '/edu/courses'

const FULL = ['courses:read', 'courses:create', 'courses:update'] as PermissionKey[]

const items = [
  { id: 'c1', name: 'Санскрит с нуля', description: 'Алфавит, падежи и сандхи' },
  { id: 'c2', name: 'Бхагавад-гита', description: 'Читаем с комментарием' },
  { id: 'c3', name: 'Практика киртана', description: '' },
]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { CoursesPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><CoursesPage /></div>',
  })

const meta: Meta<typeof CoursesPage> = { title: 'Edu/Courses', component: CoursesPage }

export default meta
type Story = StoryObj<typeof CoursesPage>

export const WithData: Story = { name: 'Данные', render: over({ [COURSES]: { items } }) }

export const Empty: Story = { name: 'Пусто', render: over({ [COURSES]: { items: [] } }) }

export const Loading: Story = { name: 'Загрузка', render: over({ [COURSES]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [COURSES]: refusal(503, 'Курсы сейчас не читаются') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over({ [COURSES]: { items } }, ['courses:read'] as PermissionKey[]),
}
