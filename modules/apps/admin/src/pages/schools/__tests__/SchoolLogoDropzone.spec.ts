import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { addMessages } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolLogoDropzone from '../ui/SchoolLogoDropzone.vue'

describe('SchoolLogoDropzone', () => {
  addMessages(messages)

  it('renders dropzone button with label and allowed formats', () => {
    const wrapper = mountWithApp(SchoolLogoDropzone)

    const btn = wrapper.find('button[data-test="open-picker"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('PNG, JPG, WebP, SVG')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mountWithApp(SchoolLogoDropzone)

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applies disabled state when disabled prop is true', () => {
    const wrapper = mountWithApp(SchoolLogoDropzone, {
      props: { disabled: true },
    })

    const btn = wrapper.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('applies error styling when error prop is provided', () => {
    const wrapper = mountWithApp(SchoolLogoDropzone, {
      props: { error: 'Invalid file' },
    })

    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('border-rose-300')
  })
})
