import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Combobox from './Combobox.vue'

const options = [
  { value: 'sanskrit', label: 'Sanskrit grammar' },
  { value: 'gita', label: 'Bhagavad-gita study' },
  { value: 'kirtan', label: 'Kirtan practice' },
]

function mountCombobox() {
  return mount(Combobox, {
    props: { options, emptyLabel: 'Nothing found' },
    attachTo: document.body,
  })
}

async function settle() {
  await nextTick()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('Combobox', () => {
  it('filters the list down to what was typed', async () => {
    const wrapper = mountCombobox()
    const input = wrapper.get('input')

    await input.trigger('focus')
    await settle()
    await input.setValue('kirt')
    await settle()

    const labels = wrapper.findAll('[role="option"]').map((item) => item.text())

    expect(labels).toEqual(['Kirtan practice'])
  })

  it('selects the highlighted option from the keyboard', async () => {
    const wrapper = mountCombobox()
    const input = wrapper.get('input')

    await input.trigger('focus')
    await settle()
    await input.setValue('gita')
    await settle()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await settle()
    await input.trigger('keydown', { key: 'Enter' })
    await settle()

    expect(wrapper.emitted('update:modelValue')).toEqual([['gita']])
  })

  it('says so when nothing matches', async () => {
    const wrapper = mountCombobox()
    const input = wrapper.get('input')

    await input.trigger('focus')
    await settle()
    await input.setValue('nothing like this')
    await settle()

    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Nothing found')
  })
})
