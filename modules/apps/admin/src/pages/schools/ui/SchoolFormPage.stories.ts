import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolFormPage from './SchoolFormPage.vue'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const SCHOOL = '/edu/schools/school-1'

const FULL = ['schools:create', 'schools:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, props: Record<string, unknown> = {}, permissions = FULL) =>
  () => ({
    components: { SchoolFormPage },
    setup() {
      signInWith(permissions)
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
