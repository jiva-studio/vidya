import type { StorybookConfig } from '@storybook/vue3-vite'

/**
 * One Storybook, living in the application.
 *
 * It shows both the primitives of @vidya/ui and whole screens of the admin,
 * because an application may depend on a library and not the other way round.
 * Screens are mounted over the same fake transport the tests use, so a story
 * needs neither the API nor a database.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../../../libs/ui/src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  addons: [],
}

export default config
