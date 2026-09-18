import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import GroupFormPage from './GroupFormPage.vue'

/**
 * The group form. "Без прав" is absent on purpose: the screen is behind
 * `groups:update`, and a reader without it never reaches it (AC-7).
 */
const GROUP = '/edu/groups/g1'

const FULL = ['groups:read', 'groups:create', 'groups:update', 'courses:read'] as PermissionKey[]

const courses = { '/edu/courses': { items: [{ id: 'c1', name: 'Санскрит с нуля' }] } }

const edit = { route: { name: 'group-edit', params: { groupId: 'g1' } } }

const over = (answers: FakeAnswers) => () => ({
  components: { GroupFormPage },
  setup() {
    signInAs(FULL)
    return {}
  },
  provide: { [httpClientKey as symbol]: fakeHttpClient({ ...courses, ...answers }).client },
  template: '<div class="p-[--space-6]"><GroupFormPage /></div>',
})

const meta: Meta<typeof GroupFormPage> = { title: 'Edu/GroupForm', component: GroupFormPage }

export default meta
type Story = StoryObj<typeof GroupFormPage>

export const WithData: Story = {
  name: 'Данные',
  parameters: edit,
  render: over({ [GROUP]: { id: 'g1', name: 'Утренняя группа', courseId: 'c1' } }),
}

export const Empty: Story = {
  name: 'Пусто',
  parameters: { route: { name: 'group-create' } },
  render: over({}),
}

export const Loading: Story = {
  name: 'Загрузка',
  parameters: edit,
  render: over({ [GROUP]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  parameters: edit,
  render: over({ [GROUP]: refusal(503, 'Группа сейчас не читается') }),
}
