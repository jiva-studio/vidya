import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Dropzone from './Dropzone.vue'

const props = {
  accept: 'image/*',
  label: 'Drop a picture here',
  hint: 'PNG, JPEG or WebP',
  browseLabel: 'Choose a file',
  refusedLabel: 'That file is not a picture',
}

function fileOf(name: string, type: string): File {
  return new File(['x'], name, { type })
}

function dropEvent(files: File[]): Event {
  const event = new Event('drop', { bubbles: true })
  Object.defineProperty(event, 'dataTransfer', { value: { files } })
  return event
}

function mountZone(extra: Record<string, unknown> = {}) {
  return mount(Dropzone, { props: { ...props, ...extra }, attachTo: document.body })
}

// The zone binds its listeners on the flush after mount, so a drop dispatched
// in the same tick as the mount lands on an element nothing is listening to.
async function drop(wrapper: ReturnType<typeof mountZone>, files: File[]) {
  await wrapper.vm.$nextTick()
  wrapper.element.dispatchEvent(dropEvent(files))
  await wrapper.vm.$nextTick()
}

describe('Dropzone', () => {
  it('hands on a file of a kind it accepts', async () => {
    const wrapper = mountZone()

    await drop(wrapper, [fileOf('dawn.png', 'image/png')])

    expect(wrapper.emitted('files')?.[0][0]).toHaveLength(1)
    expect(wrapper.emitted('refused')).toBeUndefined()
  })

  it('refuses a file of a kind it does not accept and says so', async () => {
    const wrapper = mountZone()

    await drop(wrapper, [fileOf('lecture.mp4', 'video/mp4')])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(wrapper.emitted('refused')?.[0][0]).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toBe('That file is not a picture')
  })

  it('splits a drop that carries both kinds at once', async () => {
    const wrapper = mountZone()

    await drop(wrapper, [fileOf('dawn.png', 'image/png'), fileOf('lecture.mp4', 'video/mp4')])

    expect(wrapper.emitted('files')?.[0][0]).toHaveLength(1)
    expect(wrapper.emitted('refused')?.[0][0]).toHaveLength(1)
  })

  it('matches an exact type as well as a family', async () => {
    const wrapper = mountZone({ accept: 'video/mp4' })

    await drop(wrapper, [fileOf('lecture.webm', 'video/webm')])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(wrapper.emitted('refused')?.[0][0]).toHaveLength(1)
  })

  it('takes nothing while it is disabled', async () => {
    const wrapper = mountZone({ disabled: true })

    await drop(wrapper, [fileOf('dawn.png', 'image/png')])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(wrapper.emitted('refused')).toBeUndefined()
  })

  it('shows nothing refused before anything has been dropped', () => {
    expect(mountZone().find('[role="alert"]').exists()).toBe(false)
  })
})
