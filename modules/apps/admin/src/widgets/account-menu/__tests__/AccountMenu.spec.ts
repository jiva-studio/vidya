import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, translate } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import AccountMenu from '../ui/AccountMenu.vue'

const mountMenu = (
  props: { name: string; email?: string } = { name: 'Ann', email: 'ann@example.com' },
) => mountWithApp(AccountMenu, { props })

describe('AccountMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    const copy = `
action-sign-out = Sign out
language-label = Language
account-menu-label = Account
`
    addMessages({ en: copy, ru: copy })
  })

  it('renders the trigger with user name and avatar', () => {
    const wrapper = mountMenu({ name: 'Ann Developer' })

    expect(wrapper.find('button').text()).toContain('Ann Developer')
  })

  it('toggles the dropdown menu when trigger is clicked', async () => {
    const wrapper = mountMenu()

    const trigger = wrapper.findAll('button')[0]
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('ann@example.com')
    expect(wrapper.text()).toContain(translate('action-sign-out'))
  })

  it('emits sign-out event when sign out button is clicked', async () => {
    const wrapper = mountMenu()

    const trigger = wrapper.findAll('button')[0]
    await trigger.trigger('click')
    await flushPromises()

    const signOutBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes(translate('action-sign-out')))
    await signOutBtn?.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('sign-out')).toHaveLength(1)
  })
})
