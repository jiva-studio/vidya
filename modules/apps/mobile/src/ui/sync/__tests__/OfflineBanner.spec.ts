// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OfflineBanner from '../components/Availability/OfflineBanner.vue'
import { fluentFor } from './fluentFor'

const render = (online: boolean, syncing = false) =>
  mount(OfflineBanner, { props: { online, syncing }, global: { plugins: [fluentFor('en')] } })

/**
 * Offline is visible and does not read as breakage.
 *
 * The token governs the network, not the local data, so the banner says what
 * still works instead of announcing a failure.
 */
describe('offline is a mode, not a fault', () => {
  it('tells the student the app is working offline', () => {
    expect(render(false).attributes('data-mode')).toBe('offline')
  })

  it('says what can still be done rather than what broke', () => {
    const text = render(false).text().toLowerCase()

    expect(text).toContain('you can read everything you have downloaded')
    expect(text).not.toContain('error')
  })

  it('does not paint offline as an error', () => {
    expect(render(false).find('ion-text').classes()).not.toContain('ion-color-danger')
  })

  it('shows a run in progress once the connection is back', () => {
    expect(render(true, true).attributes('data-mode')).toBe('syncing')
  })

  it('settles into an up-to-date state when nothing is running', () => {
    const wrapper = render(true, false)

    expect(wrapper.attributes('data-mode')).toBe('synced')
    expect(wrapper.text()).toContain('Up to date')
  })
})
