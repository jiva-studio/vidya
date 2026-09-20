import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { FailingUploadPrefix, FakeMediaGateway } from '@/entities/media'
import { addMessages, locale } from '@/shared/i18n'
import { manualClock } from '@/shared/lib'

import { messages } from '../i18n'
import { contentOf, draftOf, imageBlock, sectionOf } from './documents'
import { accessibleName, openEditor, saveDraft } from './harness'

addMessages(messages)
locale.value = 'en'

const AddLabel = 'Add an image'

const lesson = () => contentOf(sectionOf('s1', 'The alphabet', [imageBlock('m1')]))

const open = async () => {
  const clock = manualClock()
  const opened = await openEditor(draftOf(lesson()), undefined, new FakeMediaGateway({ clock }))

  return { ...opened, clock }
}

const media = (wrapper: { element: Element }): HTMLElement => {
  const node = wrapper.element.querySelector<HTMLElement>('[data-block-id="m1"]')
  if (!node) throw new Error('no media block on screen')
  return node
}

const control = (wrapper: { element: Element }, label: string) =>
  [...media(wrapper).querySelectorAll('button')].find((node) => accessibleName(node) === label)

/** The one line an empty media block is, which also takes a dropped file. */
const addRow = (wrapper: { element: Element }): HTMLElement => {
  const row = control(wrapper, AddLabel)
  if (!row) throw new Error('the empty media block offers no way to add a file')
  return row
}

const drop = async (wrapper: { element: Element }, file: File) => {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [file], items: [], types: ['Files'] },
  })

  addRow(wrapper).dispatchEvent(event)
  await flushPromises()
}

const run = async (clock: ReturnType<typeof manualClock>, ticks = 40) => {
  for (let tick = 0; tick < ticks; tick += 1) {
    clock.advance(50)
    await flushPromises()
  }
}

const picture = (name = 'Chart.png') => new File(['x'.repeat(64)], name, { type: 'image/png' })

const progress = (wrapper: { element: Element }) =>
  media(wrapper).querySelector('[role="progressbar"]')

const alert = (wrapper: { element: Element }) => media(wrapper).querySelector('[role="alert"]')

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('an empty media block', () => {
  it('is one line and nothing else', async () => {
    const { wrapper } = await open()

    expect([...media(wrapper).querySelectorAll('button')].map(accessibleName)).toEqual([AddLabel])
    expect(media(wrapper).querySelectorAll('input')).toHaveLength(0)
  })

  it('asks for a file of the kind it can hold, where the file is chosen', async () => {
    const { wrapper } = await open()

    addRow(wrapper).click()
    await flushPromises()

    const chooser = document.body.querySelector('input[type="file"]')
    expect(chooser?.getAttribute('accept')).toContain('image/')
  })

  it('refuses a file of the wrong kind and stays empty', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, new File(['x'], 'Lecture.mp4', { type: 'video/mp4' }))
    await run(clock)

    expect(media(wrapper).querySelector('img')).toBeNull()
    expect(progress(wrapper)).toBeNull()
    expect(control(wrapper, AddLabel)).toBeDefined()
  })

  it('says which kinds it would have taken', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, new File(['x'], 'Lecture.mp4', { type: 'video/mp4' }))
    await run(clock)

    expect(alert(wrapper)?.textContent?.toLowerCase()).toContain('image')
  })
})

describe('uploading into a block', () => {
  it('shows the upload advancing while it runs', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture())
    clock.advance(50)
    await flushPromises()

    const bar = progress(wrapper)
    expect(bar).not.toBeNull()
    expect(Number(bar?.getAttribute('aria-valuenow'))).toBeLessThan(100)

    await run(clock)
    expect(progress(wrapper)).toBeNull()
  })

  it('shows what was uploaded once it has arrived', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture())
    await run(clock)

    expect(media(wrapper).querySelector('img')?.getAttribute('src')).toMatch(/^blob:/)
  })

  it('reports the file by name when it lands', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture())
    await run(clock)

    expect(document.body.textContent).toContain('Chart.png')
  })

  it('stores the path the server will serve and never the url of the tab', async () => {
    const { wrapper, http, clock } = await open()

    await drop(wrapper, picture())
    await run(clock)
    await saveDraft()

    const sent = JSON.stringify(http.calls.filter((call) => call.method === 'PATCH'))
    expect(sent).toContain('/media/')
    expect(sent).not.toContain('blob:')
  })
})

describe('an upload that does not arrive', () => {
  it('says so in the block rather than anywhere else', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture(`${FailingUploadPrefix}ing.png`))
    await run(clock)

    expect(alert(wrapper)).not.toBeNull()
    expect(progress(wrapper)).toBeNull()
  })

  it('offers to send the same file again', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture(`${FailingUploadPrefix}ing.png`))
    await run(clock)

    const retry = control(wrapper, 'Try again')
    expect(retry).toBeDefined()

    retry?.click()
    await flushPromises()
    clock.advance(50)
    await flushPromises()

    expect(progress(wrapper)).not.toBeNull()
  })
})

describe('an upload the author changes their mind about', () => {
  it('stops it and leaves the block as empty as it was', async () => {
    const { wrapper, clock } = await open()

    await drop(wrapper, picture())
    clock.advance(50)
    await flushPromises()

    control(wrapper, 'Cancel')?.click()
    await flushPromises()
    await run(clock)

    expect(progress(wrapper)).toBeNull()
    expect(media(wrapper).querySelector('img')).toBeNull()
    expect(control(wrapper, AddLabel)).toBeDefined()
  })
})
