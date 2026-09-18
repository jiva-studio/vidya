import '../src/app/styles/index.css'

import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import type { RouteLocationRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { installSectionMessages, sectionRoutes } from '../src/app/sections'
import { fluent } from '../src/shared/i18n'

/**
 * One router for the whole Storybook, over the application's own routes.
 *
 * Every screen links by route name, so a story without a router either fails to
 * render or renders a screen whose links throw. The records are the real ones —
 * a link that leads nowhere in the application leads nowhere here too — over a
 * memory history, because a story must not touch the address bar. The guards
 * are left off: a story shows a screen under the session it asked for.
 */
const router = createRouter({ history: createMemoryHistory(), routes: sectionRoutes() })

// Every section's texts, in both languages, exactly as the application installs
// them. A story that had to add its own would show a screen no one will see.
installSectionMessages()

setup((app) => {
  app.use(fluent)
  app.use(router)
})

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },

  // A screen that reads its parameters from the address says which address with
  // `parameters.route`, and the router is there before the screen mounts.
  decorators: [
    (story, context) => {
      const target = context.parameters.route as RouteLocationRaw | undefined
      if (target) void router.replace(target)
      return story()
    },
  ],
}

export default preview
