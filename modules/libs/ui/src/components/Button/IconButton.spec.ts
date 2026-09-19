import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import IconButton from './IconButton.vue'

const icon = '<svg data-test="icon" />'

describe('IconButton', () => {
  it('carries the accessible name it was given', () => {
    const wrapper = mount(IconButton, { props: { label: 'Edit' }, slots: { default: icon } })

    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Edit')
    expect(button.text()).toBe('')
    expect(button.find('[data-test="icon"]').exists()).toBe(true)
  })

  it('emits a click when it is idle', async () => {
    const wrapper = mount(IconButton, { props: { label: 'Edit' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('blocks a click while it is busy and keeps the name on the spinner', async () => {
    const wrapper = mount(IconButton, { props: { label: 'Accept', busy: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Accept')
  })

  it('warns when the name it needs is blank', () => {
    const warned: unknown[] = []
    const warn = console.warn
    console.warn = (message: unknown) => warned.push(message)

    mount(IconButton, { props: { label: '  ' } })
    console.warn = warn

    expect(warned).toHaveLength(1)
  })
})
