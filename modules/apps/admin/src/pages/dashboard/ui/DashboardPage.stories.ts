import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { signInAs } from '@/shared/testing'

import DashboardPage from './DashboardPage.vue'

/**
 * The landing screen after signing in: one island per thing this role may do.
 *
 * The owner sees every island; a reviewer sees the homework queue and nothing
 * else. Both stories read the real queues, so their figures are whatever the
 * fixtures behind them hold.
 */
const meta: Meta<typeof DashboardPage> = {
  title: 'Admin/Daily work/Dashboard',
  component: DashboardPage,
}

export default meta
type Story = StoryObj<typeof DashboardPage>

const shownAs = (granted: PermissionKey[]) => ({
  components: { DashboardPage },
  setup() {
    signInAs(granted)
    return {}
  },
  template: '<div class="p-[var(--space-6)]"><DashboardPage /></div>',
})

/** Everything a school owner may do, so every island is on the page. */
export const Default: Story = { render: () => shownAs(['*']) }

export const Reviewer: Story = { render: () => shownAs(['homework:read', 'homework:grade']) }
