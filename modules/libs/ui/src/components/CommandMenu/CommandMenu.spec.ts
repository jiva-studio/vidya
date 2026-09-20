import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CommandMenu from './CommandMenu.vue'

const items = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video', description: 'An upload or a link' },
  { value: 'quiz', label: 'Quiz', disabled: true },
]

function mountMenu(term = '') {
  return mount(CommandMenu, {
    props: {
      items,
      term,
      placeholder: 'Search blocks',
      emptyLabel: 'Nothing matches that',
      label: 'Insert a block',
    },
    attachTo: document.body,
  })
}

describe('CommandMenu', () => {
  it('offers everything while nothing has been typed', () => {
    const wrapper = mountMenu()

    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('Nothing matches that')
  })

  it('keeps only what the typed text names', () => {
    const wrapper = mountMenu('vid')

    const labels = wrapper.findAll('[role="option"]').map((option) => option.text())
    expect(labels).toEqual(['VideoAn upload or a link'])
  })

  it('states that nothing matches rather than showing an empty list', () => {
    const wrapper = mountMenu('sitar')

    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Nothing matches that')
  })

  it('hands the typed text back to whoever owns it', async () => {
    const wrapper = mountMenu()

    const input = wrapper.get('input')
    await input.setValue('ima')

    expect(wrapper.emitted('update:term')).toEqual([['ima']])
  })

  it('reports the item that was chosen', async () => {
    const wrapper = mountMenu()

    await wrapper.findAll('[role="option"]')[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([['image']])
  })

  it('asks to close on Escape', async () => {
    const wrapper = mountMenu()

    await wrapper.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
