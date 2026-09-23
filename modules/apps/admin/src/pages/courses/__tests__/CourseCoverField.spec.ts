import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { MediaPickerDialog } from '@/features/pick-media'
import { addMessages, locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import CourseCoverField from '../ui/CourseCoverField.vue'

addMessages(messages)
locale.value = 'en'

describe('CourseCoverField', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders empty state with choose button when modelValue is empty or null', () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: null },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    const chooseBtn = wrapper.find(
      'button[data-test="choose-cover"], button[data-action="pick"], button',
    )
    expect(chooseBtn.exists()).toBe(true)
  })

  it('renders inline image preview when modelValue contains an image URL', () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: 'https://cdn.example.com/cover.jpg' },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://cdn.example.com/cover.jpg')
  })

  it('opens MediaPickerDialog with image kind when choose button is clicked', async () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: null },
    })

    const picker = wrapper.findComponent(MediaPickerDialog)
    expect(picker.exists()).toBe(true)
    expect(picker.props('open')).toBe(false)
    expect(picker.props('kind')).toBe('image')

    const chooseBtn = wrapper.find('button')
    await chooseBtn.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(MediaPickerDialog).props('open')).toBe(true)
  })

  it('emits update:modelValue with selected image URL when media is picked from MediaPickerDialog', async () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: null },
    })

    const picker = wrapper.findComponent(MediaPickerDialog)
    picker.vm.$emit('pick', { url: 'https://cdn.example.com/selected-cover.jpg', source: 'upload' })
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      'https://cdn.example.com/selected-cover.jpg',
    ])
  })

  it('emits update:modelValue with null when remove button is clicked', async () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: 'https://cdn.example.com/cover.jpg' },
    })

    const removeBtn = wrapper.find(
      'button[data-test="remove-cover"], button[data-action="remove"], button[aria-label*="remove" i], button[aria-label*="clear" i]',
    )
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([null])
  })

  it('renders change / replace button when modelValue is present and opens dialog on click', async () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: 'https://cdn.example.com/cover.jpg' },
    })

    const changeBtn = wrapper.find(
      'button[data-test="change-cover"], button[data-action="change"], button[aria-label*="change" i], button[aria-label*="replace" i]',
    )
    expect(changeBtn.exists()).toBe(true)
    await changeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(MediaPickerDialog).props('open')).toBe(true)
  })

  it('displays error message when error prop is provided', () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: null, error: 'Cover image is invalid' },
    })

    expect(wrapper.text()).toContain('Cover image is invalid')
  })

  it('disables actions when disabled prop is true', () => {
    const wrapper = mountWithApp(CourseCoverField, {
      props: { modelValue: 'https://cdn.example.com/cover.jpg', disabled: true },
    })

    const buttons = wrapper.findAll('button')
    for (const btn of buttons) {
      expect(btn.attributes('disabled')).toBeDefined()
    }
  })
})
