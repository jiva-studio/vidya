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

  it('emits update:modelValue when digits change', async () => {
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
  })
})
