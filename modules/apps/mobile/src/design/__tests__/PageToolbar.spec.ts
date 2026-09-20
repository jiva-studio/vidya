// @vitest-environment jsdom
import { IonBackButton } from '@ionic/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageToolbar from '../components/PageToolbar.vue'

const render = (props: Record<string, unknown> = {}) =>
  mount(PageToolbar, { props: { title: 'Sanskrit, first steps', ...props } })

/**
 * A back button with neither a stack nor an href hides itself, so a screen
 * opened from a link would have no way out. Every screen therefore carries the
 * way back by default, and the two that sit at the root of a tab — where there
 * is nothing behind them — are the ones that have to say otherwise.
 */
describe('the page toolbar carries the way back', () => {
  it('offers a back button by default, so a screen cannot silently lose one', () => {
    expect(render().findComponent(IonBackButton).exists()).toBe(true)
  })

  it('sends a screen opened from a link to the catalogue when nothing is behind it', () => {
    expect(render().find('ion-back-button').attributes('default-href')).toBe('/education/courses')
  })

  it('returns to the parent a screen names for itself', () => {
    const wrapper = render({ backHref: '/education/my-enrollments' })

    expect(wrapper.find('ion-back-button').attributes('default-href')).toBe(
      '/education/my-enrollments',
    )
  })

  it('leaves the button out where there is nothing behind the screen', () => {
    expect(render({ backHref: null }).findComponent(IonBackButton).exists()).toBe(false)
  })
})
