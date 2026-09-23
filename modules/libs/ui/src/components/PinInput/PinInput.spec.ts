import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PinInput from './PinInput.vue'

describe('PinInput', () => {
  it('renders eight slots by default', () => {
    const wrapper = mount(PinInput, {
      props: {
        modelValue: '',
      },
    })

    const inputs = wrapper.findAll('input[aria-label*="pin input"]')
    expect(inputs).toHaveLength(8)
  })

  it('renders specified number of slots', () => {
    const wrapper = mount(PinInput, {
      props: {
        length: 6,
        modelValue: '',
      },
    })

    const inputs = wrapper.findAll('input[aria-label*="pin input"]')
    expect(inputs).toHaveLength(6)
  })

  it('renders provided modelValue across input slots', async () => {
    const wrapper = mount(PinInput, {
      props: {
        length: 8,
        modelValue: '1234',
      },
    })

    const inputs = wrapper.findAll('input[aria-label*="pin input"]')
    expect((inputs[0].element as HTMLInputElement).value).toBe('1')
    expect((inputs[1].element as HTMLInputElement).value).toBe('2')
    expect((inputs[2].element as HTMLInputElement).value).toBe('3')
    expect((inputs[3].element as HTMLInputElement).value).toBe('4')
    expect((inputs[4].element as HTMLInputElement).value).toBe('')
  })

  it('applies danger border class when invalid prop is true', () => {
    const wrapper = mount(PinInput, {
      props: {
        length: 4,
        invalid: true,
      },
    })

    const inputs = wrapper.findAll('input[aria-label*="pin input"]')
    for (const input of inputs) {
      expect(input.classes()).toContain('border-[var(--color-danger-border)]')
    }
  })

  it('disables all inputs when disabled prop is true', () => {
    const wrapper = mount(PinInput, {
      props: {
        length: 4,
        disabled: true,
      },
    })

    const inputs = wrapper.findAll('input[aria-label*="pin input"]')
    for (const input of inputs) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })
})
