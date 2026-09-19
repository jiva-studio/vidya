import { mount } from '@vue/test-utils'
import type { Component } from 'vue'

import { fluent } from '../i18n'
import type { MountOptions } from './types'

/**
 * Mounts a screen with the plugins the application installs.
 *
 * Every track's mounted tests go through here, so a component that works in one
 * suite and fails in another means the component differs, not the harness. A
 * slice's own texts are added by the suite with `addMessages`, because a test
 * that needed the whole application assembled would not be a unit of anything.
 */
export const mountWithApp = (component: Component, options: MountOptions = {}) => {
  const globals = options.global ?? {}

  return mount(component, {
    ...options,
    global: {
      ...globals,
      plugins: [fluent, ...(globals.plugins ?? [])],
      stubs: { RouterLink: true, ...(globals.stubs ?? {}) },
    },
  } as Parameters<typeof mount>[1])
}
