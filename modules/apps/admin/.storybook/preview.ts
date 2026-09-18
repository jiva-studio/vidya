import '../src/app/styles/index.css'

import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'

import { fluent } from '../src/shared/i18n'

// The same plugins the application installs, so a story is the screen rather
// than a version of it that happens to render.
setup((app) => {
  app.use(fluent)
})

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
}

export default preview
