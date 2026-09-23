import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { MediaPickerDialog } from '@/features/pick-media'
import { addMessages, locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolLogoField from '../ui/SchoolLogoField.vue'

addMessages(messages)
locale.value = 'en'

describe('SchoolLogoField', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders an input field for URL fallback', () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: '' },
    })

    const input = wrapper.find('input[name="logoUrl"]')
    expect(input.exists()).toBe(true)
  })

  it('emits update:modelValue when text is typed into the input fallback', async () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: '' },
    })

    const input = wrapper.find('input[name="logoUrl"]')
    await input.setValue('https://example.com/logo.png')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['https://example.com/logo.png'])
  })

  it('renders inline image preview when modelValue has an image URL', () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: 'https://example.com/logo.png' },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/logo.png')
  })

  it('opens MediaPickerDialog when choose / picker trigger button is clicked', async () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: '' },
    })

    const picker = wrapper.findComponent(MediaPickerDialog)
    expect(picker.exists()).toBe(true)
    expect(picker.props('open')).toBe(false)

    const triggerBtn = wrapper.find(
      'button[data-test="open-picker"], button[aria-label*="picker" i], button[aria-label*="logo" i], button[data-action="pick"]',
    )
    if (triggerBtn.exists()) {
      await triggerBtn.trigger('click')
      expect(wrapper.findComponent(MediaPickerDialog).props('open')).toBe(true)
    } else {
      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
      await buttons[0].trigger('click')
      expect(wrapper.findComponent(MediaPickerDialog).props('open')).toBe(true)
    }
  })

  it('updates modelValue when media is chosen from MediaPickerDialog', async () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: '' },
    })

    const picker = wrapper.findComponent(MediaPickerDialog)
    picker.vm.$emit('pick', { url: 'https://example.com/picked-logo.png', source: 'upload' })
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      'https://example.com/picked-logo.png',
    ])
  })

  it('clears modelValue when remove button is clicked', async () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: 'https://example.com/existing-logo.png' },
    })

    const removeBtn = wrapper.find(
      'button[data-test="remove-logo"], button[data-action="remove"], button[aria-label*="remove" i], button[aria-label*="clear" i]',
    )
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([''])
  })

  it('displays error message when error prop is set', () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: '', error: 'Needs a link beginning with http:// or https://' },
    })

    expect(wrapper.text()).toContain('Needs a link beginning with http:// or https://')
  })

  it('disables controls when disabled prop is true', () => {
    const wrapper = mountWithApp(SchoolLogoField, {
      props: { modelValue: 'https://example.com/logo.png', disabled: true },
    })

    const input = wrapper.find('input[name="logoUrl"]')
    if (input.exists()) {
      expect(input.attributes('disabled')).toBeDefined()
    }
    const buttons = wrapper.findAll('button')
    for (const btn of buttons) {
      expect(btn.attributes('disabled')).toBeDefined()
    }
  })
})
