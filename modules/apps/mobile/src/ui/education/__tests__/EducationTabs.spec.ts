// @vitest-environment jsdom
import { IonTabButton } from '@ionic/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, shallowRef } from 'vue'

import EducationTabBar from '../components/EducationTabBar.vue'
import EducationIndexPage from '../EducationIndexPage.vue'

// What IonTabs hands its bar. A bar mounted without it reads the injection on
// mount and fails before it renders anything.
const tabBarData = shallowRef({
  hasRouterOutlet: false,
  _tabsWillChange: () => undefined,
  _tabsDidChange: () => undefined,
})

const global = { mocks: { $t: (key: string) => key }, provide: { tabBarData } }

// IonTabs looks for an outlet by component name and refuses to render without
// one; the real outlet would want a router this test has no use for.
const OutletStub = defineComponent({
  name: 'IonRouterOutlet',
  render: () => null,
})

const tabsOf = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAllComponents(IonTabButton).map((tab) => tab.props())

/**
 * The bar is placed and populated by `ion-tabs` and `ion-tab-bar` themselves,
 * and both look at what is actually rendered: the bar at the `bottom` slot of
 * the element, the tabs among the bar's own children. Markup that reads
 * correctly but hides either one leaves a screen with no navigation at all.
 */
describe('the education tabs are placed where Ionic looks for them', () => {
  it('hands the bar to the bottom slot of ion-tabs', () => {
    const wrapper = mount(EducationIndexPage, {
      global: { ...global, stubs: { IonRouterOutlet: OutletStub } },
    })

    expect(wrapper.find('ion-tabs > ion-tab-bar[slot="bottom"]').exists()).toBe(true)
  })

  it('leaves the tab buttons as children of the bar rather than of a wrapper', () => {
    const wrapper = mount(EducationTabBar, { global })

    expect(wrapper.findAll('ion-tab-bar > ion-tab-button')).toHaveLength(3)
  })

  it('points the tabs at the catalogue, the student’s own courses and settings', () => {
    const wrapper = mount(EducationTabBar, { global })

    expect(tabsOf(wrapper).map((tab) => tab.href)).toEqual([
      '/education/courses',
      '/education/my-enrollments',
      '/education/settings',
    ])
  })

  it('names each icon-only tab for a reader that cannot see the icon', () => {
    const wrapper = mount(EducationTabBar, { global })
    const labels = wrapper.findAll('ion-tab-button').map((tab) => tab.attributes('aria-label'))

    expect(labels).toEqual(['tab-courses', 'tab-my-enrollments', 'tab-settings'])
  })
})
