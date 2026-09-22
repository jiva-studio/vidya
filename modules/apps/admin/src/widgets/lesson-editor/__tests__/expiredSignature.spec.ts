import type { BlockId, VideoBlock } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MediaGateway, MediaPage, MediaQuery, MediaRecord } from '@/entities/media'
import { MediaError, mediaGatewayKey } from '@/entities/media'
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

/**
 * The position the element is at, and every position written back into it.
 *
 * Assigning `src` runs the resource selection algorithm, which returns the
 * element to zero; jsdom loads nothing, so the only thing a test here can see
 * is whether the component remembered the position and put it back.
 */
const watchPosition = (node: HTMLVideoElement) => {
  const restored: number[] = []
  let at = 0

  Object.defineProperty(node, 'currentTime', {
    configurable: true,
    get: () => at,
    set: (value: number) => {
      at = value
      restored.push(value)
    },
  })

  return {
    restored,
    playTo(seconds: number) {
      at = seconds
    },
  }
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

  it('keeps the same player rather than putting a new one in its place', async () => {
    const { wrapper } = await open()
    const before = player(wrapper)

    before.dispatchEvent(new Event('error'))
    await flushPromises()

    expect(player(wrapper)).toBe(before)
    expect(wrapper.element.querySelector('p')).toBeNull()
  })

  it('puts the viewer back where they were watching, not at the beginning', async () => {
    const { wrapper } = await open()
    const position = watchPosition(player(wrapper))

    position.playTo(42)
    player(wrapper).dispatchEvent(new Event('error'))
    await flushPromises()

    expect(position.restored).toEqual([42])
    expect(player(wrapper).currentTime).toBe(42)
  })

  it('states the absence once it has asked as often as it is going to', async () => {
    const { wrapper, primed } = await open()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      wrapper.element.querySelector('video')?.dispatchEvent(new Event('error'))
      await flushPromises()
    }

    expect(primed.length).toBeLessThanOrEqual(4)
    expect(wrapper.element.querySelector('video')).toBeNull()
    expect(wrapper.text()).toContain('editor-preview-media-missing')
  })
})

describe('a screen whose addresses could not be asked for at all', () => {
  const refusingGateway = (): MediaGateway => {
    const gateway: MediaGateway = {
      async upload(): Promise<MediaRecord> {
        throw new Error('this suite uploads nothing')
      },
      async list(_query: MediaQuery): Promise<MediaPage> {
        throw new Error('this suite lists nothing')
      },
      resolve(): string | undefined {
        return undefined
      },
    }

    Object.assign(gateway, {
      async prime(): Promise<void> {
        throw new MediaError('media-unavailable')
      },
    })

    return gateway
  }

  it('states the absence instead of leaving the block empty', async () => {
    const wrapper = mountWithApp(MediaPreview, {
      props: { block: videoBlock() },
      global: { provide: { [mediaGatewayKey as symbol]: refusingGateway() } },
    })

    await flushPromises()

    expect(wrapper.element.querySelector('video')).toBeNull()
    expect(wrapper.text()).toContain('editor-preview-media-missing')
  })
})
