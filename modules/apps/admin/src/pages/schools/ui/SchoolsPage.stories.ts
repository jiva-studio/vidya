import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import SchoolsPage from './SchoolsPage.vue'

const SCHOOLS = '/edu/schools'

const FULL = ['schools:read', 'schools:create', 'schools:update'] as PermissionKey[]
const READER = ['schools:read'] as PermissionKey[]

/** The screen itself, over the transport the tests use, through the same seam. */
const over =
  (answers: FakeAnswers, permissions: PermissionKey[] = FULL) =>
  () => ({
    components: { SchoolsPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><SchoolsPage /></div>',
  })

const items = [
  { id: 'school-1', name: 'First school' },
  { id: 'school-2', name: 'Evening courses' },
]

const meta: Meta<typeof SchoolsPage> = {
  title: 'Admin/Organisation/Schools',
  component: SchoolsPage,
}

export default meta
type Story = StoryObj<typeof SchoolsPage>

export const Default: Story = { render: over({ [SCHOOLS]: { items } }) }

export const Loading: Story = { render: over({ [SCHOOLS]: pending() }) }

export const Empty: Story = { render: over({ [SCHOOLS]: { items: [] } }) }

export const Failed: Story = { render: over({ [SCHOOLS]: refusal(503, 'Storage is unavailable') }) }

export const Denied: Story = { render: over({ [SCHOOLS]: { items } }, READER) }
