import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Button from './Button.vue'

describe('Button', () => {
  it('emits a click when it is idle', async () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('blocks a second click while it is busy', async () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } })

    await wrapper.trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.trigger('click')
    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('shows a spinner with an accessible name while busy', () => {
    const wrapper = mount(Button, { props: { busy: true, busyLabel: 'Saving' } })

    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Saving')
  })

  it('does not emit when disabled', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
