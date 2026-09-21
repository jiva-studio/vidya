import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useSiteStatus } from '@/shared/status'

import { useLocalRead } from '../useLocalRead'

const render = (read: () => Promise<string>) =>
  mount(
    defineComponent({
      setup() {
        const { data, reading } = useLocalRead(read, 'nothing')
        return () => h('p', `${data.value}/${reading.value}`)
      },
    }),
  )

describe('one read of the local database', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('says it is still reading before the first answer is in', () => {
    const screen = render(async () => 'rows')

    expect(screen.text()).toBe('nothing/true')
  })

  it('stops saying so once the answer is in', async () => {
    const screen = render(async () => 'rows')

    await flushPromises()

    expect(screen.text()).toBe('rows/false')
  })

  it('reads again when a run has applied something', async () => {
    const read = vi.fn().mockResolvedValue('rows')
    render(read)
    await flushPromises()

    useSiteStatus().runFinished(3, false)
    await flushPromises()

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps the screen up when the database cannot be read at all', async () => {
    const screen = render(() => Promise.reject(new Error('no such table: sync_rows')))

    await flushPromises()

    expect(screen.text()).toBe('nothing/false')
  })
})
