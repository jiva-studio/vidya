import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { FailingUploadPrefix, FakeMediaGateway } from '@/entities/media'
import { addMessages, locale } from '@/shared/i18n'
import { manualClock } from '@/shared/lib'

import { messages } from '../i18n'
import { contentOf, draftOf, imageBlock, sectionOf } from './documents'
import { accessibleName, openEditor } from './harness'

addMessages(messages)
locale.value = 'en'

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

const fileInput = (wrapper: { element: Element }): HTMLInputElement => {
  const input = media(wrapper).querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('the empty media block offers no way to choose a file')
  return input
}

const choose = async (wrapper: { element: Element }, file: File) => {
  const input = fileInput(wrapper)
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
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

const control = (wrapper: { element: Element }, label: string) =>
  [...media(wrapper).querySelectorAll('button')].find((node) => accessibleName(node) === label)

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('an empty media block', () => {
  it('asks for a file of the kind it can hold', async () => {
    const { wrapper } = await open()

    expect(fileInput(wrapper).getAttribute('accept')).toContain('image/')
  })

  it('refuses a file of the wrong kind and stays empty', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, new File(['x'], 'Lecture.mp4', { type: 'video/mp4' }))
    await run(clock)

    expect(media(wrapper).querySelector('img')).toBeNull()
    expect(progress(wrapper)).toBeNull()
  })

  it('says which kinds it would have taken', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, new File(['x'], 'Lecture.mp4', { type: 'video/mp4' }))
    await run(clock)

    const refusal = media(wrapper).querySelector('[role="alert"]')
    expect(refusal?.textContent?.toLowerCase()).toContain('image')
  })
})

describe('uploading into a block', () => {
  it('shows the upload advancing while it runs', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, picture())
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

    await choose(wrapper, picture())
    await run(clock)

    expect(media(wrapper).querySelector('img')?.getAttribute('src')).toMatch(/^blob:/)
  })

  it('reports the file by name when it lands', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, picture())
    await run(clock)

    expect(document.body.textContent).toContain('Chart.png')
  })

  it('stores the path the server will serve and never the url of the tab', async () => {
    const { wrapper, http, clock } = await open()

    await choose(wrapper, picture())
    await run(clock)

    const sent = JSON.stringify(http.calls.filter((call) => call.method === 'PATCH'))
    expect(sent).not.toContain('blob:')
  })
})

describe('an upload that does not arrive', () => {
  it('says so in the block rather than anywhere else', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, picture(`${FailingUploadPrefix}ing.png`))
    await run(clock)

    expect(media(wrapper).querySelector('[role="alert"]')).not.toBeNull()
    expect(progress(wrapper)).toBeNull()
  })

  it('offers to send the same file again', async () => {
    const { wrapper, clock } = await open()

    await choose(wrapper, picture(`${FailingUploadPrefix}ing.png`))
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

    await choose(wrapper, picture())
    clock.advance(50)
    await flushPromises()

    control(wrapper, 'Cancel')?.click()
    await flushPromises()
    await run(clock)

    expect(progress(wrapper)).toBeNull()
    expect(media(wrapper).querySelector('img')).toBeNull()
    expect(fileInput(wrapper)).toBeDefined()
  })
})
