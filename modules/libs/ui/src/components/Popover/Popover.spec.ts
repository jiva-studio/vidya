import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Popover from './Popover.vue'

const trigger = '<button type="button" data-test="trigger">Insert</button>'

async function settle() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function mountPopover(open = false) {
  return mount(Popover, {
    props: { label: 'Insert a block', open },
    slots: { trigger, default: '<p>Pick what goes into the lesson.</p>' },
    attachTo: document.body,
  })
}

describe('Popover', () => {
  it('stays shut until it is opened', () => {
    mountPopover()

    expect(document.body.textContent).not.toContain('Pick what goes into the lesson.')
  })

  it('asks to open when the trigger is used', async () => {
    const wrapper = mountPopover()

    await wrapper.get('[data-test="trigger"]').trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[true]])
  })

  it('names the panel for someone who cannot see where it is anchored', async () => {
    mountPopover(true)
    await settle()

    expect(document.body.querySelector('[aria-label="Insert a block"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Pick what goes into the lesson.')
  })

  it('asks to close on Escape', async () => {
    const wrapper = mountPopover(true)
    await settle()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
