import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolsPage from './SchoolsPage.vue'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const SCHOOLS = '/edu/schools'

const FULL = ['schools:read', 'schools:create', 'schools:update'] as PermissionKey[]
const READER = ['schools:read'] as PermissionKey[]

/** The screen itself, over the transport the tests use, through the same seam. */
const over =
  (answers: FakeAnswers, permissions: PermissionKey[] = FULL) =>
  () => ({
    components: { SchoolsPage },
    setup() {
      signInWith(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><SchoolsPage /></div>',
  })

const items = [
  { id: 'school-1', name: 'Первая школа' },
  { id: 'school-2', name: 'Вечерние курсы' },
]

const meta: Meta<typeof SchoolsPage> = { title: 'Org/Schools', component: SchoolsPage }

export default meta
type Story = StoryObj<typeof SchoolsPage>

export const WithData: Story = { name: 'Данные', render: over({ [SCHOOLS]: { items } }) }

export const Empty: Story = { name: 'Пусто', render: over({ [SCHOOLS]: { items: [] } }) }

export const Loading: Story = { name: 'Загрузка', render: over({ [SCHOOLS]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [SCHOOLS]: refusal(503, 'Хранилище недоступно') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over({ [SCHOOLS]: { items } }, READER),
}
