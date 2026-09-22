import type { BlockId, ImageBlock } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MediaGateway, MediaPage, MediaRecord, UploadRequest } from '@/entities/media'
import { mediaGatewayKey } from '@/entities/media'
import { mountWithApp } from '@/shared/testing'

import MediaBlockEditor from '../ui/MediaBlockEditor.vue'

const STORED = '/media/00000000-0000-4000-8000-000000000001'
const ADDRESS = 'https://cdn.test/one.png?sig=1'

const savedBlock = (): ImageBlock => ({
  id: '00000000-0000-4000-8000-0000000000b1' as unknown as BlockId,
  type: 'image',
  source: 'upload',
  url: STORED,
})

/** Storage that answers an address for a file, once it has been asked about it. */
const signingGateway = () => {
  const held = new Map<string, string>()

  const gateway: MediaGateway = {
    async upload(_request: UploadRequest): Promise<MediaRecord> {
      throw new Error('this suite uploads nothing')
    },
    async list(): Promise<MediaPage> {
      return { items: [], total: 0, page: 1, pageSize: 24 }
    },
    resolve(url: string): string | undefined {
      return held.get(url)
    },
  }

  Object.assign(gateway, {
    async prime(urls: string[]): Promise<void> {
      for (const url of urls) held.set(url, ADDRESS)
    },
  })

  return gateway
}

const open = async () => {
  const wrapper = mountWithApp(MediaBlockEditor, {
    props: { block: savedBlock(), kind: 'image' as const },
    global: { provide: { [mediaGatewayKey as symbol]: signingGateway() } },
  })

  await flushPromises()
  await flushPromises()

  return wrapper
}

describe('a block whose file was uploaded in an earlier session', () => {
  it('shows the picture the author put there', async () => {
    const wrapper = await open()

    expect(wrapper.element.querySelector('img')?.getAttribute('src')).toBe(ADDRESS)
  })

  it('does not tell the author their own file is unavailable', async () => {
    const wrapper = await open()

    expect(wrapper.text()).not.toContain('editor-media-unavailable')
  })
})
