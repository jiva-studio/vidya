// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageWithHeaderLayout from '../layouts/PageWithHeaderLayout.vue'

const render = () => mount(PageWithHeaderLayout, { props: { title: 'Courses' } })

/**
 * The header and the tab bar are both translucent, so a list runs under them
 * rather than stopping at their edge. The top edge Ionic reserves itself for a
 * fullscreen content; the bottom edge belongs to a bar the page knows nothing
 * about, so the page reserves that one.
 */
describe('a page leaves its edges free of the chrome over them', () => {
  it('marks its header flat, which is what the theme hangs the fade on', () => {
    const header = render().find('ion-header')

    expect(header.classes()).toEqual(expect.arrayContaining(['flat-header', 'ion-no-border']))
  })

  it('keeps room below the last row for the bar that floats over it', () => {
    expect(render().find('.reserved-space').exists()).toBe(true)
  })
})

/**
 * A notice explaining why a page has nothing on it cannot live inside the
 * page's content: that is the slot the empty state replaces, so the one screen
 * that most needs the explanation would be the one screen without it.
 */
describe('a page shows its notices whatever state it is in', () => {
  const withNotice = (props: Record<string, unknown>) =>
    mount(PageWithHeaderLayout, {
      props: { title: 'Courses', ...props },
      slots: { notice: '<p class="notice">sign in again</p>', default: '<ul class="rows" />' },
    })

  it('keeps the notice on a page whose content the empty state has taken over', () => {
    const wrapper = withNotice({ isEmpty: true, hasData: true, emptyText: 'nothing here' })

    expect(wrapper.find('.rows').exists()).toBe(false)
    expect(wrapper.find('.notice').exists()).toBe(true)
  })

  it('keeps the notice while the page is still loading', () => {
    expect(withNotice({ busy: true, hasData: false }).find('.notice').exists()).toBe(true)
  })
})
