import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { addMessages } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolLogoPreview from '../ui/SchoolLogoPreview.vue'

describe('SchoolLogoPreview', () => {
  addMessages(messages)

  it('renders logo image with provided src and alt', () => {
    const wrapper = mountWithApp(SchoolLogoPreview, {
      props: {
        src: 'https://cdn.example.com/logo.png',
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://cdn.example.com/logo.png')
    expect(img.attributes('alt')).toBe('School logo')
  })

  it('emits change event when change button is clicked', async () => {
    const wrapper = mountWithApp(SchoolLogoPreview, {
      props: {
        src: 'https://cdn.example.com/logo.png',
      },
    })

    const changeBtn = wrapper.find('[data-test="open-picker"]')
    expect(changeBtn.exists()).toBe(true)
    await changeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('emits remove event when remove button is clicked', async () => {
    const wrapper = mountWithApp(SchoolLogoPreview, {
      props: {
        src: 'https://cdn.example.com/logo.png',
      },
    })

    const removeBtn = wrapper.find('[data-test="remove-logo"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('disables buttons when disabled prop is true', () => {
    const wrapper = mountWithApp(SchoolLogoPreview, {
      props: {
        src: 'https://cdn.example.com/logo.png',
        disabled: true,
      },
    })

    const changeBtn = wrapper.find('[data-test="open-picker"]')
    const removeBtn = wrapper.find('[data-test="remove-logo"]')

    expect(changeBtn.attributes('disabled')).toBeDefined()
    expect(removeBtn.attributes('disabled')).toBeDefined()
  })
})
