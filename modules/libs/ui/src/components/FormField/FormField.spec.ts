import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Input from '../Input/Input.vue'
import FormField from './FormField.vue'

const slot = `
  <Input :id="params.id" :described-by="params.describedBy" :invalid="params.invalid" />
`

function mountField(props: Record<string, unknown>) {
  return mount(FormField, {
    props,
    slots: { default: slot },
    global: { components: { Input } },
  })
}

describe('FormField', () => {
  it('ties the label to the control', () => {
    const wrapper = mountField({ label: 'Course name' })

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'))
  })

  it('links the error to the field through aria-describedby', () => {
    const wrapper = mountField({ label: 'Course name', error: 'A course needs a name.' })

    const input = wrapper.get('input')
    const error = wrapper.get('[role="alert"]')

    expect(error.attributes('id')).toBe(input.attributes('aria-describedby'))
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(error.text()).toBe('A course needs a name.')
  })

  it('describes the field by its hint while there is no error', () => {
    const wrapper = mountField({ label: 'Course name', hint: 'Shown to students.' })

    const describedBy = wrapper.get('input').attributes('aria-describedby')

    expect(wrapper.get(`#${describedBy}`).text()).toBe('Shown to students.')
  })

  it('replaces the hint with the error rather than reading both', async () => {
    const wrapper = mountField({ hint: 'Shown to students.', error: 'Too short.' })

    expect(wrapper.text()).not.toContain('Shown to students.')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe(
      wrapper.get('[role="alert"]').attributes('id'),
    )
  })
})
