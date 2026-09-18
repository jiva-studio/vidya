// @vitest-environment jsdom
import { IonProgressBar } from '@ionic/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BackfillProgress from '../components/Availability/BackfillProgress.vue'
import { fluentFor } from './fluentFor'

const render = (done: number, total: number, slot?: string) =>
  mount(BackfillProgress, {
    props: { done, total },
    slots: slot ? { default: slot } : {},
    global: { plugins: [fluentFor('en')] },
  })

/**
 * T-U-3. The first run, when the device has the least to show.
 *
 * Backfill is the one moment a student can open the app and find nothing there,
 * so the screen says what is happening and how far it has got.
 */
describe('T-U-3: the first run fills the device in the open', () => {
  it('is never an empty screen', () => {
    expect(render(0, 0).text().length).toBeGreaterThan(0)
  })

  it('shows how far the download has got', () => {
    expect(render(3, 12).text()).toContain('3 of 12')
  })

  it('moves the bar with the count', () => {
    expect(render(3, 12).getComponent(IonProgressBar).props('value')).toBe(0.25)
  })

  it('does not pretend to know a total it has not counted yet', () => {
    const bar = render(0, 0).getComponent(IonProgressBar)

    expect(bar.props('type')).toBe('indeterminate')
  })

  it('shows what has already arrived alongside the progress', () => {
    expect(render(1, 4, '<p>Bhagavad-gita as it is</p>').text()).toContain('Bhagavad-gita')
  })
})
