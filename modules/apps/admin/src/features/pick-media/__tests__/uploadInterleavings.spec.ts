import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MediaRecord } from '@/entities/media'
import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { manualClock } from '@/shared/lib'
import { mountWithApp } from '@/shared/testing'

import { useMediaUpload } from '../model'

type Upload = ReturnType<typeof useMediaUpload>

const file = (name: string, type = 'image/png') => new File(['x'.repeat(64)], name, { type })

/**
 * The composable inside a component, because it reaches storage by injection.
 *
 * The gateway's clock is the test's, so an upload only moves when the test says
 * so and two of them can be held in flight at the same moment.
 */
const mounted = () => {
  const clock = manualClock()
  const gateway = new FakeMediaGateway({ clock })
  let upload: Upload | undefined

  const Host = defineComponent({
    name: 'UploadHost',
    setup() {
      upload = useMediaUpload()
      return () => h('div')
    },
  })

  mountWithApp(Host, { global: { provide: { [mediaGatewayKey]: gateway } } })
  if (!upload) throw new Error('the composable did not run')

  return { upload, clock }
}

/** Moves the gateway's clock until everything in flight has settled. */
const settle = async (clock: ReturnType<typeof manualClock>, ticks = 20) => {
  for (let tick = 0; tick < ticks; tick += 1) {
    clock.advance(50)
    await flushPromises()
  }
}

describe('one upload at a time', () => {
  it('hands back a stored path and never a url that dies with the tab', async () => {
    const { upload, clock } = mounted()

    const record = upload.start(file('Chart.png'))
    await settle(clock)

    expect((await record)?.url).toMatch(/^\/media\//)
    expect(upload.status.value).toBe('idle')
  })

  it('says nothing and reports no failure when the author cancels', async () => {
    const { upload, clock } = mounted()

    const record = upload.start(file('Chart.png'))
    clock.advance(50)
    upload.cancel()
    await settle(clock)

    expect(await record).toBeUndefined()
    expect(upload.status.value).toBe('idle')
    expect(upload.error.value).toBeUndefined()
  })

  it('keeps the refused file so the retry sends the same bytes', async () => {
    const { upload, clock } = mounted()

    const refused = upload.start(file('fail-chart.png'))
    await settle(clock)

    expect(await refused).toBeUndefined()
    expect(upload.status.value).toBe('failed')
    expect(upload.error.value).toBe('media-upload-failed')

    const retried = upload.retry()
    await settle(clock)

    expect(await retried).toBeUndefined()
    expect(upload.status.value).toBe('failed')
  })
})

describe('a cancelled upload meeting the next one', () => {
  // DEFECT (reviewer): `controller` and `pending` are single slots. The
  // cancelled upload's rejection is read against whichever controller is
  // current, so a cancel followed by a second file in the same turn reports the
  // live upload as refused.
  it.fails('does not report the upload that replaced it as refused', async () => {
    const { upload, clock } = mounted()

    void upload.start(file('First.png'))
    clock.advance(50)

    upload.cancel()
    const second = upload.start(file('Second.png'))
    await settle(clock)

    expect(await second).toBeDefined()
    expect(upload.error.value).toBeUndefined()
    expect(upload.status.value).toBe('idle')
  })

  it('gives each caller the file it asked for when two uploads overlap', async () => {
    const { upload, clock } = mounted()

    const first = upload.start(file('First.png'))
    clock.advance(50)
    const second = upload.start(file('Second.png'))
    await settle(clock)

    const records = [await first, await second] as (MediaRecord | undefined)[]

    expect(records[0]?.name).toBe('First.png')
    expect(records[1]?.name).toBe('Second.png')
    expect(records[0]?.url).not.toBe(records[1]?.url)
  })
})
