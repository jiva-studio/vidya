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

    const changeBtn = wrapper.find(
      'button[aria-label*="change" i], button[aria-label*="изменить" i], button[data-action="pick"]',
    )
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

    const removeBtn = wrapper.find(
      'button[aria-label*="remove" i], button[aria-label*="удалить" i], button[data-action="remove"]',
    )
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

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    for (const btn of buttons) {
      expect(btn.attributes('disabled')).toBeDefined()
    }
  })
})
