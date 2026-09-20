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
  { id: 'c1', name: 'Sanskrit from scratch', description: 'Alphabet, cases and sandhi' },
  { id: 'c2', name: 'Bhagavad-gita', description: 'Read with the commentary' },
  { id: 'c3', name: 'Kirtan practice', description: '' },
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
    template: '<div class="p-[var(--space-6)]"><CoursesPage /></div>',
  })

const meta: Meta<typeof CoursesPage> = { title: 'Admin/Teaching/Courses', component: CoursesPage }

export default meta
type Story = StoryObj<typeof CoursesPage>

export const Default: Story = { render: over({ [COURSES]: { items } }) }

export const Loading: Story = { render: over({ [COURSES]: pending() }) }

export const Empty: Story = { render: over({ [COURSES]: { items: [] } }) }

export const Failed: Story = {
  render: over({ [COURSES]: refusal(503, 'The courses cannot be read right now') }),
}

export const Denied: Story = {
  render: over({ [COURSES]: { items } }, ['courses:read'] as PermissionKey[]),
}
