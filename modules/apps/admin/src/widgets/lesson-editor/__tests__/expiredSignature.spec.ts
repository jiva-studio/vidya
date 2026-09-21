import type { BlockId, VideoBlock } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MediaGateway, MediaPage, MediaQuery, MediaRecord } from '@/entities/media'
import { mediaGatewayKey } from '@/entities/media'
import { mountWithApp } from '@/shared/testing'

import MediaPreview from '../ui/MediaPreview.vue'

const STORED = '/media/00000000-0000-4000-8000-000000000003'

const videoBlock = (): VideoBlock => ({
  id: '00000000-0000-4000-8000-0000000000b1' as unknown as BlockId,
  type: 'video',
  source: 'upload',
  url: STORED,
})

/**
 * Storage that signs a different address every time it is primed, the way a
 * server does: the old address is what the player is holding when it expires.
 */
const signingGateway = () => {
  const primed: string[][] = []
  let issued = 0

  const gateway: MediaGateway = {
    async upload(): Promise<MediaRecord> {
      throw new Error('this suite uploads nothing')
    },
    async list(_query: MediaQuery): Promise<MediaPage> {
      throw new Error('this suite lists nothing')
    },
    resolve(url: string): string | undefined {
      if (!url.startsWith('/media/')) return url
      return issued === 0 ? undefined : `https://cdn.test/clip.mp4?sig=${issued}`
    },
  }

  Object.assign(gateway, {
    async prime(urls: string[]): Promise<void> {
      primed.push(urls)
      issued += 1
    },
  })

  return { gateway, primed }
}

const open = async () => {
  const { gateway, primed } = signingGateway()
  const wrapper = mountWithApp(MediaPreview, {
    props: { block: videoBlock() },
    global: { provide: { [mediaGatewayKey as symbol]: gateway } },
  })

  await flushPromises()
  return { wrapper, primed }
}

const player = (wrapper: { element: Element }): HTMLVideoElement => {
  const node = wrapper.element.querySelector<HTMLVideoElement>('video')
  if (!node) throw new Error('the preview is showing no player at all')
  return node
}

describe('a signature that expires while the lecture is playing', () => {
  it('asks the server for an address before it draws the player', async () => {
    const { wrapper, primed } = await open()

    expect(primed).toEqual([[STORED]])
    expect(player(wrapper).getAttribute('src')).toBe('https://cdn.test/clip.mp4?sig=1')
  })

  it('asks again when the player refuses the address it was given', async () => {
    const { wrapper, primed } = await open()
    const before = player(wrapper)

    before.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(primed).toHaveLength(2)
    expect(player(wrapper).getAttribute('src')).toBe('https://cdn.test/clip.mp4?sig=2')
  })

  it('keeps the same player, so playback goes on from where it was', async () => {
    const { wrapper } = await open()
    const before = player(wrapper)

    before.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(player(wrapper)).toBe(before)
    expect(wrapper.element.querySelector('p')).toBeNull()
  })
})
