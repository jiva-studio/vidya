import '../src/app/styles/index.css'

import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import type { RouteLocationNamedRaw, RouteLocationRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { installSectionMessages, sectionRoutes } from '../src/app/sections'
import { setAppRouter } from '../src/shared/access'
import { fluent } from '../src/shared/i18n'
import { STORY_SCHOOL } from '../src/shared/testing'

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

// Every address carries the school, and a story says nothing about it: it is
// the school its session is signed into.
setAppRouter(router)

const dashboard: RouteLocationRaw = { name: 'dashboard', params: { schoolId: STORY_SCHOOL } }

const inStorySchool = (target: RouteLocationRaw | undefined): RouteLocationRaw => {
  if (!target) return dashboard
  if (typeof target === 'string' || !('name' in target)) return target

  const named = target as RouteLocationNamedRaw
  return { ...named, params: { schoolId: STORY_SCHOOL, ...named.params } }
}

// Every section's texts, in both languages, exactly as the application installs
// them. A story that had to add its own would show a screen no one will see.
installSectionMessages()

setup((app) => {
  // Hot reload re-registers this callback, and installing the router twice on
  // one app throws on $route.
  if (app.config.globalProperties.$router) return
  app.use(fluent)
  app.use(router)
})

// A screen in the application sits inside the shell's content area, which gives
// it its margins and its width. A story has no shell, so it needs them here.
const storyFrame = 'padding: var(--space-5); max-width: var(--content-max); margin: 0 auto;'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },

    // Storybook sorts alphabetically, which puts Data before Forms and Daily
    // work before Sign in. The tree is read in the order the work is done.
    options: {
      storySort: {
        order: [
          'Design system',
          ['Forms', 'Data', 'Feedback', 'Overlays', 'Layout'],
          'Admin',
          ['Sign in', 'Organisation', 'Teaching', 'Daily work', 'Parts'],
        ],
      },
    },
  },

  // A screen that reads its parameters from the address says which address with
  // `parameters.route`, and the router is there before the screen mounts.
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="${storyFrame}"><story /></div>`,
    }),
    (story, context) => {
      void router.replace(inStorySchool(context.parameters.route as RouteLocationRaw | undefined))
      return story()
    },
  ],
}

export default preview
