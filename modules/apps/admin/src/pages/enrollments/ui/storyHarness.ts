import { setup } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSession } from '@/shared/session'

const blank = { template: '<div />' }

// Storybook installs plugins through `setup`, which appends rather than
// replaces, so a section adds its own router without touching the preview the
// scaffold owns. Every name a screen of this section might link to is listed,
// because the last router installed is the one in force.
const names = ['enrollments', 'homework-queue', 'homework-review']

export const installStoryRouter = (): void => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: names.map((name) => ({ path: `/${name}`, name, component: blank })),
  })

  setup((app) => {
    app.use(router)
  })
}

/** A session with exactly the rights a story wants to show the screen under. */
export const signInWith = (permissions: PermissionKey[]): void => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}
