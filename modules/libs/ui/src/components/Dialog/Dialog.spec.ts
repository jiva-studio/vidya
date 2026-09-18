import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Dialog from './Dialog.vue'

const trigger = '<button type="button" data-test="trigger">Open</button>'

async function settle() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function mountDialog() {
  return mount(Dialog, {
    props: { title: 'Assign a group', open: false },
    slots: { trigger, default: '<p>Pick the group this student joins.</p>' },
    attachTo: document.body,
  })
}

describe('Dialog', () => {
  it('stays shut until it is opened', () => {
    const wrapper = mountDialog()

    expect(document.body.textContent).not.toContain('Pick the group this student joins.')
    expect(wrapper.find('[data-test="trigger"]').exists()).toBe(true)
  })

  it('asks to open when the trigger is used', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-test="trigger"]').trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[true]])
  })

  it('closes on Escape and gives the focus back to the trigger', async () => {
    const wrapper = mountDialog()
    const triggerEl = wrapper.get('[data-test="trigger"]').element as HTMLButtonElement
    triggerEl.focus()

    await wrapper.setProps({ open: true })
    await settle()

    expect(document.body.textContent).toContain('Pick the group this student joins.')
    expect(document.activeElement).not.toBe(triggerEl)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])

    await wrapper.setProps({ open: false })
    await settle()

    expect(document.activeElement).toBe(triggerEl)
  })
})
