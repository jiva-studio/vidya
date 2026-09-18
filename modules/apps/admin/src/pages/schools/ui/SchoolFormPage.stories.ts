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
    template: '<div class="p-[--space-6]"><SchoolFormPage v-bind="props" /></div>',
  })

const meta: Meta<typeof SchoolFormPage> = { title: 'Org/SchoolForm', component: SchoolFormPage }

export default meta
type Story = StoryObj<typeof SchoolFormPage>

export const WithData: Story = {
  name: 'Данные',
  render: over({ [SCHOOL]: { id: 'school-1', name: 'Первая школа' } }, { id: 'school-1' }),
}

export const Empty: Story = { name: 'Пусто', render: over({ 'POST /edu/schools': { id: 'x' } }) }

export const Loading: Story = {
  name: 'Загрузка',
  render: over({ [SCHOOL]: pending() }, { id: 'school-1' }),
}

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [SCHOOL]: refusal(404, 'Такой школы нет') }, { id: 'school-1' }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(
    { 'POST /edu/schools': refusal(403, 'Недостаточно прав, чтобы создать школу') },
    {},
    [] as PermissionKey[],
  ),
}
