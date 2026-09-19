import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { signInAs } from '@/shared/testing'

import DashboardPage from './DashboardPage.vue'

/**
 * The landing screen after signing in.
 *
 * It reads nothing yet, so it has one state: what a school owner sees on the
 * morning of the first day. When it starts summarising the queues it will grow
 * the other four.
 */
const meta: Meta<typeof DashboardPage> = {
  title: 'Admin/Daily work/Dashboard',
  component: DashboardPage,
}

export default meta
type Story = StoryObj<typeof DashboardPage>

export const WithData: Story = {
  name: 'Data',
  render: () => ({
    components: { DashboardPage },
    setup() {
      signInAs(['*'])
      return {}
    },
    template: '<div class="p-[var(--space-6)]"><DashboardPage /></div>',
  }),
}
