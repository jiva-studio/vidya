import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { manualClock } from '@/shared/lib'

import {
  FailingUploadPrefix,
  FakeMediaGateway,
  HttpMediaGateway,
  MediaError,
  mediaFixtures,
  MediaPageSize,
} from '..'

const file = (name: string, type = 'image/png') => new File(['x'.repeat(64)], name, { type })

/** Moves the fake's own clock until the upload it was given has settled. */
const settle = async <TResult>(
  promise: Promise<TResult>,
  clock: ReturnType<typeof manualClock>,
): Promise<TResult> => {
  let done = false
  const finished = promise.finally(() => {
    done = true
  })

  // A refusal settles while the loop below is between ticks, and a rejection
  // nobody is holding at that moment is reported as an unhandled error. The
  // caller still gets `finished`, and still sees the reason.
  finished.catch(() => undefined)

  for (let tick = 0; tick < 200 && !done; tick += 1) {
    clock.advance(50)
    await flushPromises()
  }

  return finished
}

describe('uploading a file', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hands back a path the server could serve and never a url that dies with the tab', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    const record = await settle(gateway.upload({ file: file('Chart.png') }), clock)

    expect(record.url).toMatch(/^\/media\/[0-9a-f-]{36}$/i)
    expect(record.url).not.toContain('blob:')
    expect(record.name).toBe('Chart.png')
    expect(record.kind).toBe('image')
  })

  it('reads the kind from the file rather than asking the author', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    const video = await settle(gateway.upload({ file: file('Lecture.mp4', 'video/mp4') }), clock)
    const audio = await settle(
      gateway.upload({ file: file('Recitation.mp3', 'audio/mpeg') }),
      clock,
    )

    expect(video.kind).toBe('video')
    expect(audio.kind).toBe('audio')
  })

  it('reports progress that starts at nothing and ends at everything', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })
    const reported: number[] = []

    await settle(
      gateway.upload({ file: file('Chart.png'), onProgress: (percent) => reported.push(percent) }),
      clock,
    )

    expect(reported.length).toBeGreaterThan(1)
    expect(reported[0]).toBe(0)
    expect(reported.at(-1)).toBe(100)
    expect([...reported].sort((a, b) => a - b)).toEqual(reported)
  })

  it('moves no progress until its clock is moved', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })
    const reported: number[] = []

    void gateway.upload({ file: file('Chart.png'), onProgress: (p) => reported.push(p) })
    await flushPromises()

    expect(reported.filter((percent) => percent === 100)).toEqual([])
  })

  it('refuses the file the fixtures reserve for the failure path', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    await expect(
      settle(gateway.upload({ file: file(`${FailingUploadPrefix}ing.png`) }), clock),
    ).rejects.toThrow()
  })

  it('keeps a refused upload out of the library', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    await settle(gateway.upload({ file: file(`${FailingUploadPrefix}ing.png`) }), clock).catch(
      () => undefined,
    )

    const page = await gateway.list({})
    expect(page.total).toBe(mediaFixtures.length)
  })

  it('stops when the author cancels, and keeps nothing behind', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })
    const controller = new AbortController()

    const upload = gateway.upload({ file: file('Chart.png'), signal: controller.signal })
    controller.abort()

    await expect(settle(upload, clock)).rejects.toThrow()

    const page = await gateway.list({})
    expect(page.total).toBe(mediaFixtures.length)
  })

  it('offers what was just uploaded at the head of the library', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    const record = await settle(gateway.upload({ file: file('Chart.png') }), clock)
    const page = await gateway.list({})

    expect(page.items[0].id).toBe(record.id)
    expect(page.total).toBe(mediaFixtures.length + 1)
  })
})

describe('showing a stored file', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves a file uploaded in this session to something an img can load', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })

    const record = await settle(gateway.upload({ file: file('Chart.png') }), clock)

    expect(gateway.resolve(record.url)).toMatch(/^blob:/)
  })

  it('restores uploaded files in subsequent gateway instances from storage', async () => {
    const clock = manualClock()
    const gateway1 = new FakeMediaGateway({ clock })

    const record = await settle(gateway1.upload({ file: file('Persisted.png') }), clock)

    const gateway2 = new FakeMediaGateway({ clock: manualClock() })
    const list = await gateway2.list({})
    expect(list.items[0].id).toBe(record.id)
    expect(list.items[0].name).toBe('Persisted.png')
  })

  it('knows nothing about a file it never held, which is what a reload leaves behind', () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    expect(gateway.resolve('/media/00000000-0000-4000-8000-000000000001')).toBeUndefined()
    expect(gateway.resolve('')).toBeUndefined()
  })

  it('hands an external link straight back, because nothing here has to serve it', () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    expect(gateway.resolve('https://example.org/a.png')).toBe('https://example.org/a.png')
  })
})

describe('the library the school appears to have', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('answers a page at a time', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    const first = await gateway.list({})

    expect(first.items).toHaveLength(MediaPageSize)
    expect(first.total).toBe(mediaFixtures.length)
    expect(first.page).toBe(1)
    expect(first.pageSize).toBe(MediaPageSize)
  })

  it('answers the rest on the page after it, with nothing repeated', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    const first = await gateway.list({})
    const second = await gateway.list({ page: 2 })

    expect(second.items).toHaveLength(mediaFixtures.length - MediaPageSize)
    expect(second.items.map((item) => item.id)).not.toEqual(
      expect.arrayContaining(first.items.map((item) => item.id)),
    )
  })

  it('narrows to one kind when the block only takes one', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    const page = await gateway.list({ kind: 'audio' })

    expect(page.items.every((item) => item.kind === 'audio')).toBe(true)
    expect(page.total).toBe(mediaFixtures.filter((item) => item.kind === 'audio').length)
  })

  it('searches the name without minding the case', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    const page = await gateway.list({ term: 'temple' })

    expect(page.items.map((item) => item.name)).toEqual(['Temple courtyard.jpg'])
  })

  it('answers an empty page rather than a failure when nothing matches', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    const page = await gateway.list({ term: 'nothing here' })

    expect(page.items).toEqual([])
    expect(page.total).toBe(0)
  })
})

describe('the implementation that will replace it', () => {
  it('refuses to be used while nothing serves a file', async () => {
    const gateway = new HttpMediaGateway()

    await expect(gateway.upload({ file: file('Chart.png') })).rejects.toBeInstanceOf(MediaError)
    await expect(gateway.list({})).rejects.toBeInstanceOf(MediaError)
    expect(gateway.resolve('/media/abc')).toBeUndefined()
  })
})
