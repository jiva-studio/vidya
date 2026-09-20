import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import SchoolFormPage from './SchoolFormPage.vue'

const SCHOOL = '/edu/schools/school-1'

const FULL = ['schools:create', 'schools:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, props: Record<string, unknown> = {}, permissions = FULL) =>
  () => ({
    components: { SchoolFormPage },
    setup() {
      signInAs(permissions)
      return { props }
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><SchoolFormPage v-bind="props" /></div>',
  })

const meta: Meta<typeof SchoolFormPage> = {
  title: 'Admin/Organisation/School',
  component: SchoolFormPage,
}

export default meta
type Story = StoryObj<typeof SchoolFormPage>

export const Default: Story = {
  render: over({ [SCHOOL]: { id: 'school-1', name: 'First school' } }, { id: 'school-1' }),
}

export const Loading: Story = { render: over({ [SCHOOL]: pending() }, { id: 'school-1' }) }

export const Empty: Story = { render: over({ 'POST /edu/schools': { id: 'x' } }) }

export const Failed: Story = {
  render: over({ [SCHOOL]: refusal(404, 'No such school') }, { id: 'school-1' }),
}

export const Denied: Story = {
  render: over(
    { 'POST /edu/schools': refusal(403, 'Not enough rights to create a school') },
    {},
    [] as PermissionKey[],
  ),
}
