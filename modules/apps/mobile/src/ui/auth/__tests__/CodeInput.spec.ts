// @vitest-environment jsdom
import { IonInput } from '@ionic/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CodeInput from '../components/CodeInput.vue'
import { fluentFor } from './fluentFor'

const render = (modelValue = '') =>
  mount(CodeInput, { props: { modelValue }, global: { plugins: [fluentFor()] } })

const field = (wrapper: ReturnType<typeof render>) => wrapper.findComponent(IonInput)

const lastModel = (wrapper: ReturnType<typeof render>): string | undefined => {
  const updates = wrapper.emitted('update:modelValue')
  return updates === undefined ? undefined : (updates.at(-1)?.[0] as string)
}

/**
 * A code out of an email is a run of digits, not a number.
 *
 * Nothing is one more than a code, a leading zero belongs to it, and a wheel
 * turned over the field must not change it — so the field is text with a
 * numeric keyboard rather than a number, which would also make the browser draw
 * spinner arrows inside it.
 */
describe('the box a code is typed into', () => {
  it('is not a number field, so no browser draws arrows in it', () => {
    expect(field(render()).props('type')).toBe('text')
  })

  it('asks for the numeric keyboard without asking for a number', () => {
    expect(field(render()).props('inputmode')).toBe('numeric')
  })

  it('offers the code from the message, which is what the field exists for', () => {
    expect(field(render()).props('autocomplete')).toBe('one-time-code')
  })

  it('keeps digits, including the leading zero a number would drop', async () => {
    const wrapper = render()

    await field(wrapper).vm.$emit('update:modelValue', '012345')

    expect(lastModel(wrapper)).toBe('012345')
  })

  it('drops a letter rather than carrying it into the request', async () => {
    const wrapper = render()

    await field(wrapper).vm.$emit('update:modelValue', '12a3')

    expect(lastModel(wrapper)).toBe('123')
  })

  it('drops what a paste brings with it', async () => {
    const wrapper = render()

    await field(wrapper).vm.$emit('update:modelValue', ' 12 34-56 ')

    expect(lastModel(wrapper)).toBe('123456')
  })

  it('asks to go back when the arrow is pressed', async () => {
    const wrapper = render()

    await wrapper.find('ion-icon').trigger('click')

    expect(wrapper.emitted('back-button-click')).toHaveLength(1)
  })
})
