import type { IsoDateTime } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MediaGateway, MediaPage, MediaRecord, UploadRequest } from '@/entities/media'
import { mediaGatewayKey } from '@/entities/media'
import { mountWithApp } from '@/shared/testing'

import MediaLibraryPanel from '../ui/MediaLibraryPanel.vue'

const STORED = '/media/00000000-0000-4000-8000-000000000001'
const ALSO_STORED = '/media/00000000-0000-4000-8000-000000000002'

const ADDRESSES: Record<string, string> = {
  [STORED]: 'https://cdn.test/one.png?sig=1',
  [ALSO_STORED]: 'https://cdn.test/two.png?sig=1',
}

const listed = (url: string, name: string): MediaRecord => ({
  id: url as unknown as MediaRecord['id'],
  kind: 'image',
  url,
  name,
  sizeBytes: 2048,
  createdAt: '2026-09-21T10:00:00.000Z' as unknown as IsoDateTime,
})

/** The school's library, with addresses only for the files it was asked about. */
const libraryGateway = () => {
  const primed: string[][] = []
  const held = new Map<string, string>()

  const gateway: MediaGateway = {
    async upload(_request: UploadRequest): Promise<MediaRecord> {
      throw new Error('this suite uploads nothing')
    },
    async list(): Promise<MediaPage> {
      return {
        items: [listed(STORED, 'Chart.png'), listed(ALSO_STORED, 'Diagram.png')],
        total: 2,
        page: 1,
        pageSize: 24,
      }
    },
    resolve(url: string): string | undefined {
      return held.get(url)
    },
  }

  Object.assign(gateway, {
    async prime(urls: string[]): Promise<void> {
      primed.push(urls)
      for (const url of urls) held.set(url, ADDRESSES[url])
    },
  })

  return { gateway, primed }
}

const openPanel = async () => {
  const { gateway, primed } = libraryGateway()
  const wrapper = mountWithApp(MediaLibraryPanel, {
    props: { kind: 'image' as const },
    global: { provide: { [mediaGatewayKey as symbol]: gateway } },
  })

  await flushPromises()
  await flushPromises()

  return { wrapper, primed }
}

describe('the library a picker shows', () => {
  it('shows the school its own files rather than an icon for each', async () => {
    const { wrapper } = await openPanel()

    const shown = wrapper.element.querySelectorAll('img')

    expect([...shown].map((image) => image.getAttribute('src'))).toEqual([
      ADDRESSES[STORED],
      ADDRESSES[ALSO_STORED],
    ])
  })

  it('asks for the whole page of files in one call', async () => {
    const { primed } = await openPanel()

    expect(primed).toEqual([[STORED, ALSO_STORED]])
  })
})
